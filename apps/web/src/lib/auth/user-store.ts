import { db, users } from '@wikismith/db';
import { eq } from 'drizzle-orm';
import { decryptSecret, encryptSecret } from './token-crypto';

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

  const payload = (await response.json()) as GitHubTokenRefreshResponse;
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

export const syncAuthenticatedUser = async (
  user: WorkOSUserPayload,
  oauthTokens?: OauthTokensPayload,
): Promise<void> => {
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

  if (!oauthTokens?.accessToken || !storedUser) {
    return;
  }

  const encryptedAccessToken = encryptSecret(oauthTokens.accessToken);
  const encryptedRefreshToken = oauthTokens.refreshToken
    ? encryptSecret(oauthTokens.refreshToken)
    : null;
  const expiresAt =
    oauthTokens.expiresAt === undefined
      ? null
      : new Date(
          typeof oauthTokens.expiresAt === 'number' && oauthTokens.expiresAt < 1_000_000_000_000
            ? oauthTokens.expiresAt * 1000
            : oauthTokens.expiresAt,
        );

  await db
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
    .where(eq(users.id, storedUser.id));
};

export const getStoredUserByWorkOSId = async (workosId: string) => {
  return db.query.users.findFirst({ where: (table, { eq }) => eq(table.workosId, workosId) });
};

export const getGitHubAccessTokenByWorkOSId = async (workosId: string): Promise<string | null> => {
  const record = await db.query.users.findFirst({
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

  if (record.githubTokenExpiresAt && record.githubTokenExpiresAt.getTime() <= Date.now()) {
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
      return null;
    }

    const encryptedAccessToken = encryptSecret(refreshed.accessToken);
    const encryptedRefreshToken = encryptSecret(refreshed.refreshToken);

    await db
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
      .where(eq(users.workosId, workosId));

    return refreshed.accessToken;
  }

  return decryptSecret({
    encrypted: record.githubTokenEncrypted,
    iv: record.githubTokenIv,
    tag: record.githubTokenTag,
  });
};

export const deleteUserByWorkOSId = async (workosId: string): Promise<boolean> => {
  const deleted = await db
    .delete(users)
    .where(eq(users.workosId, workosId))
    .returning({ id: users.id });

  return deleted.length > 0;
};
