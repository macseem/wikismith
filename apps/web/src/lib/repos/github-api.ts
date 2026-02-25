import { AppError } from '@wikismith/shared';

const GITHUB_API_BASE = 'https://api.github.com';

export interface GitHubRepositorySummary {
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  isPrivate: boolean;
  defaultBranch: string;
  language: string | null;
  pushedAt: string | null;
}

interface GitHubRepositoryPayload {
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  default_branch: string;
  language: string | null;
  pushed_at: string | null;
  owner: {
    login: string;
  };
}

const toRepositorySummary = (repo: GitHubRepositoryPayload): GitHubRepositorySummary => ({
  owner: repo.owner.login,
  name: repo.name,
  fullName: repo.full_name,
  description: repo.description,
  isPrivate: repo.private,
  defaultBranch: repo.default_branch,
  language: repo.language,
  pushedAt: repo.pushed_at,
});

const getHeaders = (accessToken: string): HeadersInit => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${accessToken}`,
  'User-Agent': 'WikiSmith/1.0',
  'X-GitHub-Api-Version': '2022-11-28',
});

const hasNextPage = (linkHeader: string | null): boolean => {
  if (!linkHeader) {
    return false;
  }

  return linkHeader.split(',').some((segment) => segment.includes('rel="next"'));
};

interface GitHubErrorPayload {
  message?: string;
  documentation_url?: string;
}

const readGitHubErrorPayload = async (response: Response): Promise<GitHubErrorPayload | null> => {
  try {
    const payload = (await response.clone().json()) as GitHubErrorPayload;
    if (payload && typeof payload === 'object') {
      return payload;
    }
  } catch {
    return null;
  }

  return null;
};

const throwGitHubError = async (response: Response, operation: string): Promise<never> => {
  const payload = await readGitHubErrorPayload(response);
  const oauthScopes = response.headers.get('x-oauth-scopes');
  const acceptedScopes = response.headers.get('x-accepted-oauth-scopes');
  const ssoHeader = response.headers.get('x-github-sso');

  console.error('[GitHub API] Request failed', {
    operation,
    status: response.status,
    statusText: response.statusText,
    message: payload?.message,
    documentationUrl: payload?.documentation_url,
    oauthScopes,
    acceptedScopes,
    githubSso: ssoHeader,
    rateLimitRemaining: response.headers.get('x-ratelimit-remaining'),
    rateLimitReset: response.headers.get('x-ratelimit-reset'),
    requestId: response.headers.get('x-github-request-id'),
  });

  if (response.status === 401) {
    throw new AppError(
      'GitHub authorization is missing or invalid. Please sign in again.',
      'UNAUTHENTICATED',
      401,
    );
  }

  if (response.status === 403) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    if (remaining === '0') {
      const resetEpoch = response.headers.get('x-ratelimit-reset');
      const resetAt = resetEpoch
        ? new Date(Number.parseInt(resetEpoch, 10) * 1000).toISOString()
        : 'unknown';

      throw new AppError(
        `GitHub API rate limit exceeded. Try again after ${resetAt}.`,
        'GITHUB_RATE_LIMITED',
        429,
      );
    }

    if (ssoHeader?.toLowerCase().includes('required')) {
      throw new AppError(
        'GitHub organization SSO authorization is required for one or more repositories. Authorize your token for that organization and retry.',
        'GITHUB_SSO_AUTH_REQUIRED',
        403,
      );
    }

    const acceptedScopesList = (acceptedScopes ?? '')
      .split(',')
      .map((scope) => scope.trim())
      .filter((scope) => scope.length > 0);
    const hasRepoScopeHint =
      acceptedScopesList.includes('repo') || acceptedScopesList.includes('public_repo');

    if (hasRepoScopeHint || payload?.message?.toLowerCase().includes('scope')) {
      throw new AppError(
        'GitHub denied access to repository data. Re-authenticate and approve repository scopes.',
        'MISSING_GITHUB_SCOPE',
        403,
      );
    }

    throw new AppError(
      payload?.message
        ? `GitHub denied access: ${payload.message}`
        : 'GitHub denied access to repository data due to policy restrictions.',
      'GITHUB_FORBIDDEN',
      403,
    );
  }

  throw new AppError(
    `GitHub API request failed with ${response.status} ${response.statusText}.`,
    'GITHUB_API_ERROR',
    response.status,
  );
};

export interface FetchGitHubReposPageResult {
  repositories: GitHubRepositorySummary[];
  hasNextPage: boolean;
}

export const fetchGitHubReposPage = async (
  accessToken: string,
  page: number,
  perPage: number,
): Promise<FetchGitHubReposPageResult> => {
  const params = new URLSearchParams({
    visibility: 'all',
    affiliation: 'owner,collaborator,organization_member',
    sort: 'updated',
    direction: 'desc',
    page: String(page),
    per_page: String(perPage),
  });

  const response = await fetch(`${GITHUB_API_BASE}/user/repos?${params.toString()}`, {
    headers: getHeaders(accessToken),
    cache: 'no-store',
  });

  if (!response.ok) {
    await throwGitHubError(response, 'fetch_user_repos_page');
  }

  const payload = (await response.json()) as GitHubRepositoryPayload[];

  return {
    repositories: payload.map(toRepositorySummary),
    hasNextPage: hasNextPage(response.headers.get('link')),
  };
};

export const fetchGitHubBranches = async (
  accessToken: string,
  owner: string,
  repo: string,
): Promise<string[]> => {
  const ownerSegment = encodeURIComponent(owner);
  const repoSegment = encodeURIComponent(repo);
  const branches: string[] = [];
  let page = 1;

  while (page <= 20) {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${ownerSegment}/${repoSegment}/branches?per_page=100&page=${page}`,
      {
        headers: getHeaders(accessToken),
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      await throwGitHubError(response, 'fetch_repository_branches');
    }

    const payload = (await response.json()) as Array<{ name: string }>;
    branches.push(...payload.map((branch) => branch.name));

    if (!hasNextPage(response.headers.get('link'))) {
      break;
    }

    page += 1;
  }

  return branches;
};

export const fetchGitHubRepository = async (
  accessToken: string,
  owner: string,
  repo: string,
): Promise<GitHubRepositorySummary> => {
  const ownerSegment = encodeURIComponent(owner);
  const repoSegment = encodeURIComponent(repo);

  const response = await fetch(`${GITHUB_API_BASE}/repos/${ownerSegment}/${repoSegment}`, {
    headers: getHeaders(accessToken),
    cache: 'no-store',
  });

  if (!response.ok) {
    await throwGitHubError(response, 'fetch_repository');
  }

  const payload = (await response.json()) as GitHubRepositoryPayload;

  return toRepositorySummary(payload);
};
