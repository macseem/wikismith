import { handleAuth } from '@workos-inc/authkit-nextjs';
import { NextResponse } from 'next/server';
import { syncAuthenticatedUser } from '@/lib/auth/user-store';

export const dynamic = 'force-dynamic';

const callbackBaseUrl = process.env['APP_BASE_URL'];
const isGithubScopeReauthState = (state?: string): boolean =>
  Boolean(state && state.startsWith('github_scope'));

const logGitHubAuthResponse = async (label: string, response: Response): Promise<void> => {
  let message: string | undefined;
  try {
    const payload = (await response.clone().json()) as { message?: string };
    message = payload?.message;
  } catch {
    message = undefined;
  }

  console.error('[Auth callback] GitHub scope verification failed', {
    step: label,
    status: response.status,
    statusText: response.statusText,
    message,
    oauthScopes: response.headers.get('x-oauth-scopes'),
    acceptedScopes: response.headers.get('x-accepted-oauth-scopes'),
    githubSso: response.headers.get('x-github-sso'),
    requestId: response.headers.get('x-github-request-id'),
  });
};

const isTransientGitHubError = (response: Response): boolean => {
  if (response.status >= 500 || response.status === 429) {
    return true;
  }

  if (response.status !== 403) {
    return false;
  }

  return response.headers.get('x-ratelimit-remaining') === '0';
};

const hasRepositoryScope = async (accessToken: string): Promise<boolean> => {
  let response: Response;
  try {
    response = await fetch('https://api.github.com/user', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'WikiSmith/1.0',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      cache: 'no-store',
    });
  } catch {
    throw new Error('REPO_SCOPE_CHECK_FAILED');
  }

  if (!response.ok) {
    await logGitHubAuthResponse('user', response);
    throw new Error('REPO_SCOPE_CHECK_FAILED');
  }

  const scopesHeader = response.headers.get('x-oauth-scopes') ?? '';
  if (!scopesHeader) {
    let probeResponse: Response;
    try {
      probeResponse = await fetch('https://api.github.com/user/repos?visibility=all&per_page=1', {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'WikiSmith/1.0',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        cache: 'no-store',
      });
    } catch {
      throw new Error('REPO_SCOPE_CHECK_FAILED');
    }

    if (!probeResponse.ok) {
      await logGitHubAuthResponse('user_repos_probe', probeResponse);

      if (isTransientGitHubError(probeResponse) || probeResponse.status === 401) {
        throw new Error('REPO_SCOPE_CHECK_FAILED');
      }
    }

    return probeResponse.ok;
  }

  const scopes = scopesHeader
    .split(',')
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0);

  return scopes.includes('repo') || scopes.includes('public_repo');
};
export const GET = handleAuth({
  baseURL: callbackBaseUrl,
  returnPathname: '/dashboard',
  onSuccess: async ({ user, oauthTokens, state }) => {
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

    if (!oauthTokens?.accessToken) {
      throw new Error('MISSING_PROVIDER_TOKENS');
    }

    if (isGithubScopeReauthState(state)) {
      const hasScope = await hasRepositoryScope(oauthTokens.accessToken);
      if (!hasScope) {
        throw new Error('MISSING_REPO_SCOPE');
      }
    }
  },
  onError: async ({ request, error }) => {
    const url = new URL('/sign-in', request.url);

    if (error instanceof Error && error.message === 'MISSING_PROVIDER_TOKENS') {
      url.pathname = '/dashboard';
      url.searchParams.set('authError', 'missing_provider_tokens');
    } else if (error instanceof Error && error.message === 'MISSING_REPO_SCOPE') {
      url.pathname = '/dashboard';
      url.searchParams.set('authError', 'missing_repo_scope');
    } else if (error instanceof Error && error.message === 'REPO_SCOPE_CHECK_FAILED') {
      url.pathname = '/dashboard';
      url.searchParams.set('authError', 'repo_scope_check_failed');
    } else {
      url.searchParams.set('error', 'auth_failed');
    }

    return NextResponse.redirect(url);
  },
});
