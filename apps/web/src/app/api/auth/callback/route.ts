import { handleAuth } from '@workos-inc/authkit-nextjs';
import { NextResponse } from 'next/server';
import { syncAuthenticatedUser } from '@/lib/auth/user-store';

export const dynamic = 'force-dynamic';

export const GET = handleAuth({
  returnPathname: '/dashboard',
  onSuccess: async ({ user, oauthTokens }) => {
    await syncAuthenticatedUser(
      {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePictureUrl: user.profilePictureUrl,
      },
      oauthTokens
        ? {
            accessToken: oauthTokens.accessToken,
            refreshToken: oauthTokens.refreshToken,
            expiresAt: oauthTokens.expiresAt,
          }
        : undefined,
    );
  },
  onError: async ({ request }) => {
    const url = new URL('/sign-in?error=auth_failed', request.url);
    return NextResponse.redirect(url);
  },
});
