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
  const allowE2EBypass =
    process.env['E2E_BYPASS_AUTH'] === '1' &&
    process.env['PLAYWRIGHT_E2E'] === '1' &&
    process.env['NODE_ENV'] !== 'production';

  if (allowE2EBypass) {
    return {
      sessionId: 'e2e-session',
      accessToken: 'e2e-access-token',
      user: {
        workosId: process.env['E2E_WORKOS_ID'] ?? 'e2e_workos_user',
        email: process.env['E2E_USER_EMAIL'] ?? 'e2e@wikismith.local',
        name: 'E2E Test User',
        avatarUrl: null,
      },
    };
  }

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
