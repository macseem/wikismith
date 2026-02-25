'use client';

import { useAuth } from '@workos-inc/authkit-nextjs/components';

interface SessionUser {
  workosId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

interface ClientSession {
  sessionId: string;
  user: SessionUser;
}

const getName = (firstName?: string | null, lastName?: string | null): string | null => {
  const name = [firstName, lastName].filter(Boolean).join(' ').trim();
  return name.length > 0 ? name : null;
};

export const useSession = (): { session: ClientSession | null; loading: boolean } => {
  const { user, sessionId, loading } = useAuth();

  if (!user || !sessionId) {
    return { session: null, loading };
  }

  return {
    loading,
    session: {
      sessionId,
      user: {
        workosId: user.id,
        email: user.email,
        name: getName(user.firstName, user.lastName),
        avatarUrl: user.profilePictureUrl ?? null,
      },
    },
  };
};
