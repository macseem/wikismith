import { and, desc, eq, inArray } from 'drizzle-orm';
import { AppError } from '@wikismith/shared';
import { deleteWiki } from '@/lib/wiki-store';
import {
  fetchGitHubBranches,
  fetchGitHubReposPage,
  fetchGitHubRepository,
  type GitHubRepositorySummary,
} from './github-api';
import { getGitHubAccessTokenByWorkOSId, getStoredUserByWorkOSId } from '@/lib/auth/user-store';

type DbModule = typeof import('@wikismith/db');

export type WikiStatus = 'not_generated' | 'generating' | 'ready' | 'failed';

export interface RepositoryDashboardItem {
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  isPrivate: boolean;
  defaultBranch: string;
  trackedBranch: string | null;
  autoUpdate: boolean;
  lastPushedAt: string | null;
  wikiStatus: WikiStatus;
}

export interface RepositoryDashboardData {
  items: RepositoryDashboardItem[];
  availableLanguages: string[];
  pageInfo: {
    previousCursor: string | null;
    nextCursor: string | null;
  };
}

export interface RepositorySharingSettings {
  isPublic: boolean;
  embedEnabled: boolean;
  shareToken: string;
  tokenRotatedAt: string | null;
}

export interface GetRepositoryDashboardOptions {
  workosUserId: string;
  cursor?: string | null;
  query?: string;
  language?: string;
  status?: WikiStatus | 'all';
  perPage?: number;
  refresh?: boolean;
}

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

const reposPageCache = new Map<
  string,
  CacheEntry<{ repos: GitHubRepositorySummary[]; hasNext: boolean }>
>();
const branchesCache = new Map<string, CacheEntry<string[]>>();
const branchesRefreshRateLimit = new Map<string, CacheEntry<number>>();

const DEFAULT_REPO_PAGE_SIZE = 20;
const REAUTH_PATH = '/sign-in?redirect=%2Fdashboard&reauth=github_scope';
const BRANCH_REFRESH_MIN_INTERVAL_MS = 15 * 1000;

const loadDb = async (): Promise<DbModule> => {
  try {
    return await import('@wikismith/db');
  } catch (error) {
    throw new AppError(
      'Failed to load database module for repository dashboard.',
      'REPO_DB_LOAD',
      500,
      {
        cause: error,
      },
    );
  }
};

const parseRepoCacheTtlMs = (): number => {
  const rawSeconds = Number.parseInt(process.env['REPO_LIST_CACHE_TTL_SECONDS'] ?? '', 10);
  if (!Number.isFinite(rawSeconds) || rawSeconds <= 0) {
    return 10 * 60 * 1000;
  }

  const clampedSeconds = Math.min(15 * 60, Math.max(5 * 60, rawSeconds));
  return clampedSeconds * 1000;
};

const parseBranchCacheTtlMs = (): number => {
  const rawSeconds = Number.parseInt(process.env['REPO_BRANCH_CACHE_TTL_SECONDS'] ?? '', 10);
  if (!Number.isFinite(rawSeconds) || rawSeconds <= 0) {
    return 5 * 60 * 1000;
  }

  const clampedSeconds = Math.min(10 * 60, Math.max(60, rawSeconds));
  return clampedSeconds * 1000;
};

const encodeCursor = (page: number): string => Buffer.from(`page:${page}`).toString('base64url');

const decodeCursor = (cursor?: string | null): number => {
  if (!cursor) {
    return 1;
  }

  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const [prefix, rawPage] = decoded.split(':');
    if (prefix !== 'page') {
      return 1;
    }

    const page = Number.parseInt(rawPage ?? '', 10);
    if (!Number.isFinite(page) || page < 1) {
      return 1;
    }

    return page;
  } catch {
    return 1;
  }
};

const getGitHubToken = async (workosUserId: string): Promise<string> => {
  const token = await getGitHubAccessTokenByWorkOSId(workosUserId);
  if (!token) {
    throw new AppError(
      'GitHub token is not available for this session. Reconnect your account so WorkOS can return provider tokens.',
      'MISSING_GITHUB_TOKEN',
      403,
      { reauthPath: REAUTH_PATH },
    );
  }

  return token;
};

const getCached = <T>(cache: Map<string, CacheEntry<T>>, key: string): T | null => {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }

  return entry.value;
};

const pruneExpired = <T>(cache: Map<string, CacheEntry<T>>): void => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt < now) {
      cache.delete(key);
    }
  }
};

const setCached = <T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  ttlMs: number,
): void => {
  pruneExpired(cache);

  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
};

const getRepoPage = async (
  workosUserId: string,
  accessToken: string,
  page: number,
  perPage: number,
  refresh = false,
): Promise<{ repos: GitHubRepositorySummary[]; hasNext: boolean }> => {
  const key = `${workosUserId}:page:${page}:per:${perPage}`;
  const ttl = parseRepoCacheTtlMs();

  if (!refresh) {
    const cached = getCached(reposPageCache, key);
    if (cached) {
      return cached;
    }
  }

  const response = await fetchGitHubReposPage(accessToken, page, perPage);
  const value = {
    repos: response.repositories,
    hasNext: response.hasNextPage,
  };
  setCached(reposPageCache, key, value, ttl);

  return value;
};

const normalizeWikiStatus = (status: string): WikiStatus => {
  if (status === 'ready') {
    return 'ready';
  }

  if (status === 'failed') {
    return 'failed';
  }

  return 'generating';
};

const getOwnedRepository = async (workosUserId: string, owner: string, repo: string) => {
  const [user, { db, repositories }] = await Promise.all([
    getStoredUserByWorkOSId(workosUserId),
    loadDb(),
  ]);

  if (!user) {
    throw new AppError('Authenticated user record is missing.', 'USER_NOT_FOUND', 404);
  }

  const repository = await db.query.repositories.findFirst({
    where: and(
      eq(repositories.userId, user.id),
      eq(repositories.owner, owner),
      eq(repositories.name, repo),
    ),
    columns: {
      id: true,
    },
  });

  if (!repository) {
    throw new AppError(
      'Repository is not available in your dashboard yet. Refresh from GitHub and try again.',
      'REPO_NOT_FOUND',
      404,
    );
  }

  return {
    userId: user.id,
    repositoryId: repository.id,
  };
};

const getOrCreateRepositoryShare = async (workosUserId: string, owner: string, repo: string) => {
  const [{ db, wikiShares }, ownedRepository] = await Promise.all([
    loadDb(),
    getOwnedRepository(workosUserId, owner, repo),
  ]);

  let share = await db.query.wikiShares.findFirst({
    where: eq(wikiShares.repositoryId, ownedRepository.repositoryId),
    columns: {
      id: true,
      isPublic: true,
      shareToken: true,
      embedEnabled: true,
      tokenRotatedAt: true,
    },
  });

  if (!share) {
    await db
      .insert(wikiShares)
      .values({
        repositoryId: ownedRepository.repositoryId,
        isPublic: false,
        embedEnabled: false,
        shareToken: crypto.randomUUID(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing({
        target: [wikiShares.repositoryId],
      });

    share = await db.query.wikiShares.findFirst({
      where: eq(wikiShares.repositoryId, ownedRepository.repositoryId),
      columns: {
        id: true,
        isPublic: true,
        shareToken: true,
        embedEnabled: true,
        tokenRotatedAt: true,
      },
    });
  }

  if (!share) {
    throw new AppError('Failed to initialize wiki sharing settings.', 'SHARING_INIT_FAILED', 500);
  }

  return {
    repositoryId: ownedRepository.repositoryId,
    share,
  };
};

const toSharingSettings = (share: {
  isPublic: boolean;
  embedEnabled: boolean;
  shareToken: string;
  tokenRotatedAt: Date | null;
}): RepositorySharingSettings => ({
  isPublic: share.isPublic,
  embedEnabled: share.embedEnabled,
  shareToken: share.shareToken,
  tokenRotatedAt: share.tokenRotatedAt ? share.tokenRotatedAt.toISOString() : null,
});

const syncRepositoriesForUser = async (
  db: DbModule['db'],
  userId: string,
  repos: GitHubRepositorySummary[],
): Promise<Map<string, { id: string; trackedBranch: string | null; autoUpdate: boolean }>> => {
  if (repos.length === 0) {
    return new Map();
  }

  const { repositories } = await loadDb();
  const fullNames = repos.map((repo) => repo.fullName);

  await db
    .insert(repositories)
    .values(
      repos.map((repo) => ({
        userId,
        owner: repo.owner,
        name: repo.name,
        fullName: repo.fullName,
        description: repo.description,
        isPrivate: repo.isPrivate,
        defaultBranch: repo.defaultBranch,
        trackedBranch: repo.defaultBranch,
        autoUpdate: false,
        language: repo.language,
        updatedAt: new Date(),
      })),
    )
    .onConflictDoNothing({
      target: [repositories.userId, repositories.fullName],
    });

  const syncedRows = await db.query.repositories.findMany({
    where: and(eq(repositories.userId, userId), inArray(repositories.fullName, fullNames)),
    columns: {
      id: true,
      fullName: true,
      trackedBranch: true,
      autoUpdate: true,
    },
  });

  return new Map(
    syncedRows.map((repo) => [
      repo.fullName,
      {
        id: repo.id,
        trackedBranch: repo.trackedBranch,
        autoUpdate: repo.autoUpdate,
      },
    ]),
  );
};

export const getRepositoryDashboardData = async ({
  workosUserId,
  cursor,
  query,
  language,
  status = 'all',
  perPage = DEFAULT_REPO_PAGE_SIZE,
  refresh = false,
}: GetRepositoryDashboardOptions): Promise<RepositoryDashboardData> => {
  const page = decodeCursor(cursor);
  const normalizedPerPage = Math.min(100, Math.max(5, perPage));

  const [accessToken, user, { db, wikiVersions }] = await Promise.all([
    getGitHubToken(workosUserId),
    getStoredUserByWorkOSId(workosUserId),
    loadDb(),
  ]);

  if (!user) {
    throw new AppError('Authenticated user record is missing.', 'USER_NOT_FOUND', 404);
  }

  const { repos, hasNext } = await getRepoPage(
    workosUserId,
    accessToken,
    page,
    normalizedPerPage,
    refresh,
  );

  const settingsByFullName = await syncRepositoriesForUser(db, user.id, repos);
  const repositoryIds = Array.from(settingsByFullName.values()).map((repo) => repo.id);

  const latestVersionByRepository = new Map<string, { status: string }>();
  if (repositoryIds.length > 0) {
    const latestVersions = await Promise.all(
      repositoryIds.map(async (repositoryId) =>
        db.query.wikiVersions.findFirst({
          where: eq(wikiVersions.repositoryId, repositoryId),
          orderBy: [desc(wikiVersions.createdAt)],
          columns: {
            repositoryId: true,
            status: true,
          },
        }),
      ),
    );

    for (const version of latestVersions) {
      if (!version) {
        continue;
      }

      latestVersionByRepository.set(version.repositoryId, {
        status: version.status,
      });
    }
  }

  const items = repos.map((repo) => {
    const dbRepo = settingsByFullName.get(repo.fullName);
    const latestVersion = dbRepo ? latestVersionByRepository.get(dbRepo.id) : null;

    const wikiStatus = latestVersion ? normalizeWikiStatus(latestVersion.status) : 'not_generated';

    return {
      owner: repo.owner,
      name: repo.name,
      fullName: repo.fullName,
      description: repo.description,
      language: repo.language,
      isPrivate: repo.isPrivate,
      defaultBranch: repo.defaultBranch,
      trackedBranch: dbRepo?.trackedBranch ?? repo.defaultBranch,
      autoUpdate: dbRepo?.autoUpdate ?? false,
      lastPushedAt: repo.pushedAt,
      wikiStatus,
    } satisfies RepositoryDashboardItem;
  });

  const queryValue = query?.trim().toLowerCase();
  const filtered = items.filter((item) => {
    if (queryValue) {
      const haystack = `${item.fullName} ${item.description ?? ''}`.toLowerCase();
      if (!haystack.includes(queryValue)) {
        return false;
      }
    }

    if (language && language !== 'all' && (item.language ?? 'Unknown') !== language) {
      return false;
    }

    if (status !== 'all' && item.wikiStatus !== status) {
      return false;
    }

    return true;
  });

  const availableLanguages = Array.from(
    new Set(items.map((item) => item.language ?? 'Unknown').sort((a, b) => a.localeCompare(b))),
  );

  return {
    items: filtered,
    availableLanguages,
    pageInfo: {
      previousCursor: page > 1 ? encodeCursor(page - 1) : null,
      nextCursor: hasNext ? encodeCursor(page + 1) : null,
    },
  };
};

export const getRepositoryBranches = async (
  workosUserId: string,
  owner: string,
  repo: string,
  refresh = false,
): Promise<string[]> => {
  const accessToken = await getGitHubToken(workosUserId);
  const key = `${workosUserId}:${owner}/${repo}`;
  const ttl = parseBranchCacheTtlMs();

  if (refresh) {
    const now = Date.now();
    const lastRefreshAt = getCached(branchesRefreshRateLimit, key);
    if (lastRefreshAt !== null) {
      const retryAfterSeconds = Math.ceil(
        (BRANCH_REFRESH_MIN_INTERVAL_MS - (now - lastRefreshAt)) / 1000,
      );

      throw new AppError(
        'Branch refresh is rate limited. Please wait before refreshing again.',
        'BRANCH_REFRESH_RATE_LIMITED',
        429,
        { retryAfterSeconds },
      );
    }

    setCached(branchesRefreshRateLimit, key, now, BRANCH_REFRESH_MIN_INTERVAL_MS);
  }

  if (!refresh) {
    const cached = getCached(branchesCache, key);
    if (cached) {
      return cached;
    }
  }

  const branches = await fetchGitHubBranches(accessToken, owner, repo);
  setCached(branchesCache, key, branches, ttl);

  return branches;
};

export const updateRepositorySettings = async (
  workosUserId: string,
  owner: string,
  repo: string,
  trackedBranch?: string | null,
  autoUpdate?: boolean,
): Promise<void> => {
  const [accessToken, user, { db, repositories }] = await Promise.all([
    getGitHubToken(workosUserId),
    getStoredUserByWorkOSId(workosUserId),
    loadDb(),
  ]);

  if (!user) {
    throw new AppError('Authenticated user record is missing.', 'USER_NOT_FOUND', 404);
  }

  const githubRepo = await fetchGitHubRepository(accessToken, owner, repo);

  const fullName = `${owner}/${repo}`;
  const normalizedTrackedBranch =
    trackedBranch === undefined
      ? undefined
      : trackedBranch?.trim()
        ? trackedBranch.trim()
        : githubRepo.defaultBranch;

  const updateValues = {
    updatedAt: new Date(),
    ...(normalizedTrackedBranch !== undefined ? { trackedBranch: normalizedTrackedBranch } : {}),
    ...(autoUpdate !== undefined ? { autoUpdate } : {}),
    owner,
    name: repo,
    description: githubRepo.description,
    isPrivate: githubRepo.isPrivate,
    defaultBranch: githubRepo.defaultBranch,
    language: githubRepo.language,
  };

  await db
    .insert(repositories)
    .values({
      userId: user.id,
      owner,
      name: repo,
      fullName,
      description: githubRepo.description,
      isPrivate: githubRepo.isPrivate,
      defaultBranch: githubRepo.defaultBranch,
      trackedBranch: normalizedTrackedBranch ?? githubRepo.defaultBranch,
      autoUpdate: autoUpdate ?? false,
      language: githubRepo.language,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [repositories.userId, repositories.fullName],
      set: updateValues,
    });
};

export const deleteRepositoryWiki = async (
  workosUserId: string,
  owner: string,
  repo: string,
): Promise<{ removedFromCache: boolean }> => {
  return {
    removedFromCache: await deleteWiki(owner, repo, workosUserId),
  };
};

export const getRepositorySharingSettings = async (
  workosUserId: string,
  owner: string,
  repo: string,
): Promise<RepositorySharingSettings> => {
  const { share } = await getOrCreateRepositoryShare(workosUserId, owner, repo);
  return toSharingSettings(share);
};

export const updateRepositorySharingSettings = async (
  workosUserId: string,
  owner: string,
  repo: string,
  isPublic?: boolean,
  embedEnabled?: boolean,
): Promise<RepositorySharingSettings> => {
  const [{ db, wikiShares }, { repositoryId }] = await Promise.all([
    loadDb(),
    getOrCreateRepositoryShare(workosUserId, owner, repo),
  ]);

  const updateValues: {
    updatedAt: Date;
    isPublic?: boolean;
    embedEnabled?: boolean;
  } = {
    updatedAt: new Date(),
  };

  if (isPublic !== undefined) {
    updateValues.isPublic = isPublic;
  }

  if (embedEnabled !== undefined) {
    updateValues.embedEnabled = embedEnabled;
  }

  await db.update(wikiShares).set(updateValues).where(eq(wikiShares.repositoryId, repositoryId));

  const updated = await db.query.wikiShares.findFirst({
    where: eq(wikiShares.repositoryId, repositoryId),
    columns: {
      isPublic: true,
      embedEnabled: true,
      shareToken: true,
      tokenRotatedAt: true,
    },
  });

  if (!updated) {
    throw new AppError('Failed to load updated wiki sharing settings.', 'SHARING_LOAD_FAILED', 500);
  }

  return toSharingSettings(updated);
};

export const rotateRepositoryShareToken = async (
  workosUserId: string,
  owner: string,
  repo: string,
): Promise<RepositorySharingSettings> => {
  const [{ db, wikiShares }, { repositoryId }] = await Promise.all([
    loadDb(),
    getOrCreateRepositoryShare(workosUserId, owner, repo),
  ]);

  await db
    .update(wikiShares)
    .set({
      shareToken: crypto.randomUUID(),
      tokenRotatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(wikiShares.repositoryId, repositoryId));

  const updated = await db.query.wikiShares.findFirst({
    where: eq(wikiShares.repositoryId, repositoryId),
    columns: {
      isPublic: true,
      embedEnabled: true,
      shareToken: true,
      tokenRotatedAt: true,
    },
  });

  if (!updated) {
    throw new AppError('Failed to rotate wiki sharing token.', 'SHARING_ROTATE_FAILED', 500);
  }

  return toSharingSettings(updated);
};
