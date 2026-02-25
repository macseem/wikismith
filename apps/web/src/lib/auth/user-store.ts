import { eq } from 'drizzle-orm';
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

interface StoredGitHubTokenRecord {
  githubTokenEncrypted: string | null;
  githubTokenIv: string | null;
  githubTokenTag: string | null;
}

const getDisplayName = (user: WorkOSUserPayload): string | null => {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return fullName.length > 0 ? fullName : null;
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
  // NOTE: WorkOS GitHubOAuth does not return provider refresh tokens in our integration.
  // Keep provider auth access-token-only here unless WorkOS behavior changes.
  // Reconnect is the intended recovery path when GitHub rejects authorization.

  const updated = await db
    .update(users)
    .set({
      githubTokenEncrypted: encryptedAccessToken.encrypted,
      githubTokenIv: encryptedAccessToken.iv,
      githubTokenTag: encryptedAccessToken.tag,
      githubRefreshTokenEncrypted: null,
      githubRefreshTokenIv: null,
      githubRefreshTokenTag: null,
      githubTokenExpiresAt: null,
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
  const { db } = await loadDb();

  const record: StoredGitHubTokenRecord | undefined = await db.query.users.findFirst({
    where: (table, { eq }) => eq(table.workosId, workosId),
    columns: {
      githubTokenEncrypted: true,
      githubTokenIv: true,
      githubTokenTag: true,
    },
  });

  if (!record?.githubTokenEncrypted || !record.githubTokenIv || !record.githubTokenTag) {
    return null;
  }

  // Intentionally access-token-only: WorkOS GitHubOAuth does not return provider refresh tokens.
  // If this token is rejected by GitHub, callers should route users through reconnect.
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
