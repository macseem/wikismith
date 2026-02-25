import { withAuth } from '@workos-inc/authkit-nextjs';

export interface SessionUser {
  workosId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface AppSession {
  sessionId: string;
  accessToken: string;
  user: SessionUser;
}

const getName = (firstName?: string | null, lastName?: string | null): string | null => {
  const name = [firstName, lastName].filter(Boolean).join(' ').trim();
  return name.length > 0 ? name : null;
};

export const getSession = async (): Promise<AppSession | null> => {
  let auth;
  try {
    auth = await withAuth();
  } catch {
    return null;
  }

  if (!auth.user || !auth.sessionId || !auth.accessToken) {
    return null;
  }

  return {
    sessionId: auth.sessionId,
    accessToken: auth.accessToken,
    user: {
      workosId: auth.user.id,
      email: auth.user.email,
      name: getName(auth.user.firstName, auth.user.lastName),
      avatarUrl: auth.user.profilePictureUrl ?? null,
    },
  };
};
