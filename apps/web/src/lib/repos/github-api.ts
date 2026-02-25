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
  pushedAt: string;
}

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

const throwGitHubError = (response: Response): never => {
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

    throw new AppError(
      'GitHub denied access to repository data. Re-authenticate and approve repo scopes.',
      'MISSING_GITHUB_SCOPE',
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
    throwGitHubError(response);
  }

  const payload = (await response.json()) as Array<{
    name: string;
    full_name: string;
    description: string | null;
    private: boolean;
    default_branch: string;
    language: string | null;
    pushed_at: string;
    owner: {
      login: string;
    };
  }>;

  return {
    repositories: payload.map((repo) => ({
      owner: repo.owner.login,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      isPrivate: repo.private,
      defaultBranch: repo.default_branch,
      language: repo.language,
      pushedAt: repo.pushed_at,
    })),
    hasNextPage: hasNextPage(response.headers.get('link')),
  };
};

export const fetchGitHubBranches = async (
  accessToken: string,
  owner: string,
  repo: string,
): Promise<string[]> => {
  const branches: string[] = [];
  let page = 1;

  while (page <= 20) {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/branches?per_page=100&page=${page}`,
      {
        headers: getHeaders(accessToken),
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      throwGitHubError(response);
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
  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
    headers: getHeaders(accessToken),
    cache: 'no-store',
  });

  if (!response.ok) {
    throwGitHubError(response);
  }

  const payload = (await response.json()) as {
    name: string;
    full_name: string;
    description: string | null;
    private: boolean;
    default_branch: string;
    language: string | null;
    pushed_at: string;
    owner: { login: string };
  };

  return {
    owner: payload.owner.login,
    name: payload.name,
    fullName: payload.full_name,
    description: payload.description,
    isPrivate: payload.private,
    defaultBranch: payload.default_branch,
    language: payload.language,
    pushedAt: payload.pushed_at,
  };
};
