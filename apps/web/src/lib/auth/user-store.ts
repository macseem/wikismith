import { and, eq } from 'drizzle-orm';
import type { db as dbClient } from '@wikismith/db';
import { decryptSecret, encryptSecret } from './token-crypto';

type DbModule = typeof import('@wikismith/db');
type StoredUser = Awaited<ReturnType<typeof dbClient.query.users.findFirst>>;

const loadDb = async (): Promise<DbModule> => {
  try {
    return await import('@wikismith/db');
  } catch (error) {
    throw new Error('Failed to load database module.', { cause: error });
  }
};

interface WorkOSUserPayload {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  profilePictureUrl?: string | null;
}

interface OauthTokensPayload {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string | number;
}

interface GitHubTokenRefreshResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
}

interface StoredGitHubTokenRecord {
  githubTokenEncrypted: string | null;
  githubTokenIv: string | null;
  githubTokenTag: string | null;
  githubRefreshTokenEncrypted: string | null;
  githubRefreshTokenIv: string | null;
  githubRefreshTokenTag: string | null;
  githubTokenExpiresAt: Date | null;
}

const parseOauthExpiresAt = (expiresAt?: string | number): Date | null => {
  if (expiresAt === undefined) {
    return null;
  }

  if (typeof expiresAt === 'number') {
    const timestamp = expiresAt < 1_000_000_000_000 ? expiresAt * 1000 : expiresAt;
    const parsed = new Date(timestamp);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const numeric = Number(expiresAt);
  if (Number.isFinite(numeric)) {
    const timestamp = numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
    const parsed = new Date(timestamp);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(expiresAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getDisplayName = (user: WorkOSUserPayload): string | null => {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return fullName.length > 0 ? fullName : null;
};

const refreshGitHubAccessToken = async (
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date | null } | null> => {
  const clientId = process.env['GITHUB_OAUTH_CLIENT_ID'];
  const clientSecret = process.env['GITHUB_OAUTH_CLIENT_SECRET'];
  if (!clientId || !clientSecret) {
    return null;
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    return null;
  }

  let payload: GitHubTokenRefreshResponse;
  try {
    payload = (await response.json()) as GitHubTokenRefreshResponse;
  } catch {
    return null;
  }

  if (!payload.access_token || payload.error) {
    return null;
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? refreshToken,
    expiresAt:
      typeof payload.expires_in === 'number' && payload.expires_in > 0
        ? new Date(Date.now() + payload.expires_in * 1000)
        : null,
  };
};

const decryptAccessToken = (record: StoredGitHubTokenRecord): string | null => {
  if (!record.githubTokenEncrypted || !record.githubTokenIv || !record.githubTokenTag) {
    return null;
  }

  return decryptSecret({
    encrypted: record.githubTokenEncrypted,
    iv: record.githubTokenIv,
    tag: record.githubTokenTag,
  });
};

const isTokenExpired = (expiresAt: Date | null): boolean =>
  expiresAt ? expiresAt.getTime() <= Date.now() : false;

const getLatestValidAccessToken = async (
  db: DbModule['db'],
  workosId: string,
): Promise<string | null> => {
  const latest = await db.query.users.findFirst({
    where: (table, { eq }) => eq(table.workosId, workosId),
    columns: {
      githubTokenEncrypted: true,
      githubTokenIv: true,
      githubTokenTag: true,
      githubTokenExpiresAt: true,
    },
  });

  if (!latest || isTokenExpired(latest.githubTokenExpiresAt)) {
    return null;
  }

  return decryptAccessToken({
    githubTokenEncrypted: latest.githubTokenEncrypted,
    githubTokenIv: latest.githubTokenIv,
    githubTokenTag: latest.githubTokenTag,
    githubRefreshTokenEncrypted: null,
    githubRefreshTokenIv: null,
    githubRefreshTokenTag: null,
    githubTokenExpiresAt: latest.githubTokenExpiresAt,
  });
};

export const syncAuthenticatedUser = async (
  user: WorkOSUserPayload,
  oauthTokens?: OauthTokensPayload,
): Promise<void> => {
  const { db, users } = await loadDb();

  const [storedUser] = await db
    .insert(users)
    .values({
      workosId: user.id,
      email: user.email,
      name: getDisplayName(user),
      avatarUrl: user.profilePictureUrl ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: users.workosId,
      set: {
        email: user.email,
        name: getDisplayName(user),
        avatarUrl: user.profilePictureUrl ?? null,
        updatedAt: new Date(),
      },
    })
    .returning({ id: users.id });

  const fallbackUser =
    storedUser ??
    (await db.query.users.findFirst({
      where: (table, { eq }) => eq(table.workosId, user.id),
      columns: { id: true },
    }));

  if (!oauthTokens?.accessToken || !fallbackUser) {
    return;
  }

  const encryptedAccessToken = encryptSecret(oauthTokens.accessToken);
  const encryptedRefreshToken = oauthTokens.refreshToken
    ? encryptSecret(oauthTokens.refreshToken)
    : null;
  const parsedExpiresAt = parseOauthExpiresAt(oauthTokens.expiresAt);
  const expiresAt =
    oauthTokens.refreshToken || !parsedExpiresAt || parsedExpiresAt.getTime() > Date.now()
      ? parsedExpiresAt
      : null;

  const updated = await db
    .update(users)
    .set({
      githubTokenEncrypted: encryptedAccessToken.encrypted,
      githubTokenIv: encryptedAccessToken.iv,
      githubTokenTag: encryptedAccessToken.tag,
      githubRefreshTokenEncrypted: encryptedRefreshToken?.encrypted ?? null,
      githubRefreshTokenIv: encryptedRefreshToken?.iv ?? null,
      githubRefreshTokenTag: encryptedRefreshToken?.tag ?? null,
      githubTokenExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(users.id, fallbackUser.id))
    .returning({ id: users.id });

  if (updated.length === 0) {
    return;
  }
};

export const getStoredUserByWorkOSId = async (workosId: string): Promise<StoredUser> => {
  const { db } = await loadDb();
  return db.query.users.findFirst({ where: (table, { eq }) => eq(table.workosId, workosId) });
};

export const getGitHubAccessTokenByWorkOSId = async (workosId: string): Promise<string | null> => {
  const { db, users } = await loadDb();

  const record: StoredGitHubTokenRecord | undefined = await db.query.users.findFirst({
    where: (table, { eq }) => eq(table.workosId, workosId),
    columns: {
      githubTokenEncrypted: true,
      githubTokenIv: true,
      githubTokenTag: true,
      githubRefreshTokenEncrypted: true,
      githubRefreshTokenIv: true,
      githubRefreshTokenTag: true,
      githubTokenExpiresAt: true,
    },
  });

  if (!record?.githubTokenEncrypted || !record.githubTokenIv || !record.githubTokenTag) {
    return null;
  }

  if (isTokenExpired(record.githubTokenExpiresAt)) {
    if (
      !record.githubRefreshTokenEncrypted ||
      !record.githubRefreshTokenIv ||
      !record.githubRefreshTokenTag
    ) {
      return null;
    }

    const refreshToken = decryptSecret({
      encrypted: record.githubRefreshTokenEncrypted,
      iv: record.githubRefreshTokenIv,
      tag: record.githubRefreshTokenTag,
    });

    const refreshed = await refreshGitHubAccessToken(refreshToken);
    if (!refreshed) {
      return getLatestValidAccessToken(db, workosId);
    }

    const encryptedAccessToken = encryptSecret(refreshed.accessToken);
    const encryptedRefreshToken = encryptSecret(refreshed.refreshToken);

    const updated = await db
      .update(users)
      .set({
        githubTokenEncrypted: encryptedAccessToken.encrypted,
        githubTokenIv: encryptedAccessToken.iv,
        githubTokenTag: encryptedAccessToken.tag,
        githubRefreshTokenEncrypted: encryptedRefreshToken.encrypted,
        githubRefreshTokenIv: encryptedRefreshToken.iv,
        githubRefreshTokenTag: encryptedRefreshToken.tag,
        githubTokenExpiresAt: refreshed.expiresAt,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(users.workosId, workosId),
          eq(users.githubRefreshTokenEncrypted, record.githubRefreshTokenEncrypted),
          eq(users.githubRefreshTokenIv, record.githubRefreshTokenIv),
          eq(users.githubRefreshTokenTag, record.githubRefreshTokenTag),
        ),
      )
      .returning({ id: users.id });

    if (updated.length === 0) {
      return getLatestValidAccessToken(db, workosId);
    }

    return refreshed.accessToken;
  }

  return decryptAccessToken(record);
};

export const deleteUserByWorkOSId = async (workosId: string): Promise<boolean> => {
  const { db, users } = await loadDb();

  const deleted = await db
    .delete(users)
    .where(eq(users.workosId, workosId))
    .returning({ id: users.id });

  return deleted.length > 0;
};
