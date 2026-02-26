import { and, desc, eq } from 'drizzle-orm';
import type { IClassifiedFeatureTree, IWikiPage } from '@wikismith/shared';
import { getStoredUserByWorkOSId } from '@/lib/auth/user-store';

type DbModule = typeof import('@wikismith/db');

export interface StoredWiki {
  generatedByWorkosId?: string;
  owner: string;
  repo: string;
  branch?: string;
  commitSha: string;
  pages: IWikiPage[];
  featureTree: IClassifiedFeatureTree;
  analysis: {
    languages: Record<string, number>;
    frameworks: string[];
    fileCount: number;
  };
  createdAt: string;
}

interface StoredWikiVersion {
  id: string;
  commitSha: string;
  branch: string;
  featureTree: IClassifiedFeatureTree | null;
  analysis: StoredWiki['analysis'] | null;
  createdAt: Date;
}

const loadDb = async (): Promise<DbModule> => {
  try {
    return await import('@wikismith/db');
  } catch (error) {
    throw new Error('Failed to load database module.', { cause: error });
  }
};

const getUserId = async (workosId?: string): Promise<string | null> => {
  if (!workosId) {
    return null;
  }

  const user = await getStoredUserByWorkOSId(workosId);
  return user?.id ?? null;
};

const toStoredWiki = (
  owner: string,
  repo: string,
  workosId: string | undefined,
  version: StoredWikiVersion,
  pages: IWikiPage[],
): StoredWiki => ({
  generatedByWorkosId: workosId,
  owner,
  repo,
  branch: version.branch,
  commitSha: version.commitSha,
  pages,
  featureTree: version.featureTree ?? {
    repoId: `${owner}/${repo}`,
    commitSha: version.commitSha,
    features: [],
    generatedAt: version.createdAt.toISOString(),
  },
  analysis: version.analysis ?? {
    languages: {},
    frameworks: [],
    fileCount: pages.length,
  },
  createdAt: version.createdAt.toISOString(),
});

const getRepository = async (
  owner: string,
  repo: string,
  workosId?: string,
): Promise<{ id: string; userId: string } | null> => {
  const { db, repositories } = await loadDb();
  const userId = await getUserId(workosId);

  if (workosId && !userId) {
    return null;
  }

  if (!userId) {
    return null;
  }

  const repository = await db.query.repositories.findFirst({
    where: and(
      eq(repositories.userId, userId),
      eq(repositories.owner, owner),
      eq(repositories.name, repo),
    ),
    columns: {
      id: true,
      userId: true,
    },
    orderBy: [desc(repositories.updatedAt)],
  });

  return repository ?? null;
};

interface PublicWikiLookupOptions {
  requireEmbedEnabled?: boolean;
}

export const saveWiki = async (wiki: StoredWiki): Promise<void> => {
  if (!wiki.generatedByWorkosId) {
    throw new Error('generatedByWorkosId is required to persist wiki data.');
  }

  const { db, repositories, wikiVersions, wikiPages } = await loadDb();
  const user = await getStoredUserByWorkOSId(wiki.generatedByWorkosId);

  if (!user) {
    throw new Error('Authenticated user record is missing.');
  }

  const fullName = `${wiki.owner}/${wiki.repo}`;

  const pageIdMap = new Map<string, string>();
  for (const page of wiki.pages) {
    pageIdMap.set(page.id, crypto.randomUUID());
  }

  for (const page of wiki.pages) {
    if (page.parentPageId && !pageIdMap.has(page.parentPageId)) {
      throw new Error(`Wiki page parent reference is invalid: ${page.parentPageId}`);
    }
  }

  const existingRepository = await db.query.repositories.findFirst({
    where: and(eq(repositories.userId, user.id), eq(repositories.fullName, fullName)),
    columns: {
      id: true,
      defaultBranch: true,
      trackedBranch: true,
    },
  });

  if (!existingRepository) {
    await db.insert(repositories).values({
      userId: user.id,
      owner: wiki.owner,
      name: wiki.repo,
      fullName,
      defaultBranch: wiki.branch ?? 'main',
      trackedBranch: wiki.branch ?? 'main',
      updatedAt: new Date(),
    });
  }

  const repository =
    existingRepository ??
    (await db.query.repositories.findFirst({
      where: and(eq(repositories.userId, user.id), eq(repositories.fullName, fullName)),
      columns: {
        id: true,
        defaultBranch: true,
        trackedBranch: true,
      },
    }));

  if (!repository) {
    throw new Error('Repository record is missing for wiki persistence.');
  }

  const generatedAt = new Date();
  const branch = wiki.branch ?? repository.trackedBranch ?? repository.defaultBranch;

  const existingVersion = await db.query.wikiVersions.findFirst({
    where: and(
      eq(wikiVersions.repositoryId, repository.id),
      eq(wikiVersions.commitSha, wiki.commitSha),
    ),
    columns: {
      id: true,
    },
    orderBy: [desc(wikiVersions.createdAt)],
  });

  const version = existingVersion
    ? {
        id: existingVersion.id,
      }
    : (
        await db
          .insert(wikiVersions)
          .values({
            repositoryId: repository.id,
            commitSha: wiki.commitSha,
            branch,
            status: 'ready',
            errorMessage: null,
            featureTree: wiki.featureTree as unknown as Record<string, unknown>,
            analysis: wiki.analysis as unknown as Record<string, unknown>,
            featureCount: wiki.featureTree.features.length,
            pageCount: wiki.pages.length,
            generatedAt,
          })
          .returning({ id: wikiVersions.id })
      )[0];

  if (existingVersion) {
    await db
      .update(wikiVersions)
      .set({
        branch,
        status: 'ready',
        errorMessage: null,
        featureTree: wiki.featureTree as unknown as Record<string, unknown>,
        analysis: wiki.analysis as unknown as Record<string, unknown>,
        featureCount: wiki.featureTree.features.length,
        pageCount: wiki.pages.length,
        generatedAt,
      })
      .where(eq(wikiVersions.id, existingVersion.id));
  }

  if (!version) {
    throw new Error('Failed to persist wiki version.');
  }

  await db.delete(wikiPages).where(eq(wikiPages.wikiVersionId, version.id));

  await db.insert(wikiPages).values(
    wiki.pages.map((page) => {
      const id = pageIdMap.get(page.id);
      const parentPageId = page.parentPageId ? pageIdMap.get(page.parentPageId) : null;

      if (!id) {
        throw new Error(`Wiki page id mapping is missing for: ${page.id}`);
      }

      if (page.parentPageId && !parentPageId) {
        throw new Error(`Wiki page parent reference is invalid: ${page.parentPageId}`);
      }

      return {
        id,
        wikiVersionId: version.id,
        featureId: page.featureId,
        slug: page.slug,
        title: page.title,
        content: page.content,
        citations: page.citations,
        parentPageId,
        sortOrder: page.order,
      };
    }),
  );
};

export const getWiki = async (
  owner: string,
  repo: string,
  workosId?: string,
): Promise<StoredWiki | undefined> => {
  const repository = await getRepository(owner, repo, workosId);
  if (!repository) {
    return undefined;
  }

  const { db, wikiVersions, wikiPages } = await loadDb();

  const rawVersion = await db.query.wikiVersions.findFirst({
    where: and(eq(wikiVersions.repositoryId, repository.id), eq(wikiVersions.status, 'ready')),
    orderBy: [desc(wikiVersions.generatedAt), desc(wikiVersions.createdAt)],
    columns: {
      id: true,
      commitSha: true,
      branch: true,
      featureTree: true,
      analysis: true,
      createdAt: true,
    },
  });

  if (!rawVersion) {
    return undefined;
  }

  const version: StoredWikiVersion = {
    id: rawVersion.id,
    commitSha: rawVersion.commitSha,
    branch: rawVersion.branch,
    featureTree: rawVersion.featureTree as unknown as IClassifiedFeatureTree | null,
    analysis: rawVersion.analysis as unknown as StoredWiki['analysis'] | null,
    createdAt: rawVersion.createdAt,
  };

  const storedPages = await db.query.wikiPages.findMany({
    where: eq(wikiPages.wikiVersionId, version.id),
    orderBy: [wikiPages.sortOrder, wikiPages.createdAt],
    columns: {
      id: true,
      featureId: true,
      slug: true,
      title: true,
      content: true,
      citations: true,
      parentPageId: true,
      sortOrder: true,
    },
  });

  const pages: IWikiPage[] = storedPages.map((page) => ({
    id: page.id,
    featureId: page.featureId,
    slug: page.slug,
    title: page.title,
    content: page.content,
    citations: page.citations,
    parentPageId: page.parentPageId,
    order: page.sortOrder,
  }));

  return toStoredWiki(owner, repo, workosId, version, pages);
};

export const hasWiki = async (owner: string, repo: string, workosId?: string): Promise<boolean> => {
  const repository = await getRepository(owner, repo, workosId);
  if (!repository) {
    return false;
  }

  const { db, wikiVersions } = await loadDb();
  const version = await db.query.wikiVersions.findFirst({
    where: and(eq(wikiVersions.repositoryId, repository.id), eq(wikiVersions.status, 'ready')),
    columns: {
      id: true,
    },
    orderBy: [desc(wikiVersions.generatedAt), desc(wikiVersions.createdAt)],
  });

  return Boolean(version);
};

export const deleteWiki = async (
  owner: string,
  repo: string,
  workosId: string,
): Promise<boolean> => {
  const repository = await getRepository(owner, repo, workosId);

  if (!repository) {
    return false;
  }

  const { db, wikiVersions } = await loadDb();
  const versions = await db.query.wikiVersions.findMany({
    where: eq(wikiVersions.repositoryId, repository.id),
    columns: {
      id: true,
    },
  });

  if (versions.length === 0) {
    return false;
  }

  await db.delete(wikiVersions).where(eq(wikiVersions.repositoryId, repository.id));
  return true;
};

export const getPublicWikiByShareToken = async (
  shareToken: string,
  options: PublicWikiLookupOptions = {},
): Promise<StoredWiki | undefined> => {
  const { db, wikiShares, repositories, wikiVersions, wikiPages } = await loadDb();

  const share = await db.query.wikiShares.findFirst({
    where: and(eq(wikiShares.shareToken, shareToken), eq(wikiShares.isPublic, true)),
    columns: {
      repositoryId: true,
      embedEnabled: true,
    },
  });

  if (!share) {
    return undefined;
  }

  if (options.requireEmbedEnabled && !share.embedEnabled) {
    return undefined;
  }

  const repository = await db.query.repositories.findFirst({
    where: eq(repositories.id, share.repositoryId),
    columns: {
      owner: true,
      name: true,
    },
  });

  if (!repository) {
    return undefined;
  }

  const rawVersion = await db.query.wikiVersions.findFirst({
    where: and(eq(wikiVersions.repositoryId, share.repositoryId), eq(wikiVersions.status, 'ready')),
    orderBy: [desc(wikiVersions.generatedAt), desc(wikiVersions.createdAt)],
    columns: {
      id: true,
      commitSha: true,
      branch: true,
      featureTree: true,
      analysis: true,
      createdAt: true,
    },
  });

  if (!rawVersion) {
    return undefined;
  }

  const version: StoredWikiVersion = {
    id: rawVersion.id,
    commitSha: rawVersion.commitSha,
    branch: rawVersion.branch,
    featureTree: rawVersion.featureTree as unknown as IClassifiedFeatureTree | null,
    analysis: rawVersion.analysis as unknown as StoredWiki['analysis'] | null,
    createdAt: rawVersion.createdAt,
  };

  const storedPages = await db.query.wikiPages.findMany({
    where: eq(wikiPages.wikiVersionId, version.id),
    orderBy: [wikiPages.sortOrder, wikiPages.createdAt],
    columns: {
      id: true,
      featureId: true,
      slug: true,
      title: true,
      content: true,
      citations: true,
      parentPageId: true,
      sortOrder: true,
    },
  });

  const pages: IWikiPage[] = storedPages.map((page) => ({
    id: page.id,
    featureId: page.featureId,
    slug: page.slug,
    title: page.title,
    content: page.content,
    citations: page.citations,
    parentPageId: page.parentPageId,
    order: page.sortOrder,
  }));

  return toStoredWiki(repository.owner, repository.name, undefined, version, pages);
};
