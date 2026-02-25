import { IngestionError } from '@wikismith/shared';
import { GITHUB_API_BASE } from './constants';

export interface RepoMetadata {
  owner: string;
  name: string;
  defaultBranch: string;
  isPrivate: boolean;
}

export interface GitHubClientOptions {
  token?: string;
}

const headers = (token?: string): Record<string, string> => {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'WikiSmith/1.0',
  };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
};

const handleRateLimit = (response: Response) => {
  const remaining = response.headers.get('x-ratelimit-remaining');
  if (remaining === '0') {
    const resetAt = response.headers.get('x-ratelimit-reset');
    const resetDate = resetAt ? new Date(parseInt(resetAt, 10) * 1000).toISOString() : 'unknown';
    throw new IngestionError(
      `GitHub API rate limit exceeded. Resets at ${resetDate}. Use an authenticated token for higher limits.`,
      'RATE_LIMITED',
      429,
    );
  }
};

export const fetchRepoMetadata = async (
  owner: string,
  name: string,
  opts?: GitHubClientOptions,
): Promise<RepoMetadata> => {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${name}`;
  const response = await fetch(url, { headers: headers(opts?.token) });

  if (response.status === 404) {
    throw new IngestionError(
      `Repository "${owner}/${name}" not found. Check the URL and ensure the repository exists.`,
      'REPO_NOT_FOUND',
      404,
    );
  }

  if (response.status === 403) {
    handleRateLimit(response);
    throw new IngestionError(
      `Access denied for "${owner}/${name}". The repository may be private — authenticate via GitHub to access it.`,
      'ACCESS_DENIED',
      403,
    );
  }

  if (!response.ok) {
    throw new IngestionError(
      `GitHub API error: ${response.status} ${response.statusText}`,
      'GITHUB_API_ERROR',
      response.status,
    );
  }

  const data = (await response.json()) as {
    default_branch: string;
    private: boolean;
  };

  return {
    owner,
    name,
    defaultBranch: data.default_branch,
    isPrivate: data.private,
  };
};

export const resolveCommitSha = async (
  owner: string,
  name: string,
  ref: string,
  opts?: GitHubClientOptions,
): Promise<string> => {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${name}/commits/${encodeURIComponent(ref)}`;
  const response = await fetch(url, {
    headers: { ...headers(opts?.token), Accept: 'application/vnd.github.sha' },
  });

  if (response.status === 422 || response.status === 404) {
    throw new IngestionError(
      `Ref "${ref}" not found in "${owner}/${name}". Check the branch, tag, or commit SHA.`,
      'REF_NOT_FOUND',
      404,
    );
  }

  if (response.status === 403) {
    handleRateLimit(response);
    throw new IngestionError(
      `Access denied for "${owner}/${name}". The repository may be private — authenticate via GitHub to access it.`,
      'ACCESS_DENIED',
      403,
    );
  }

  if (!response.ok) {
    throw new IngestionError(
      `Failed to resolve ref "${ref}": ${response.status} ${response.statusText}`,
      'RESOLVE_REF_ERROR',
      response.status,
    );
  }

  return (await response.text()).trim();
};

export const downloadTarball = async (
  owner: string,
  name: string,
  ref: string,
  opts?: GitHubClientOptions,
): Promise<ArrayBuffer> => {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${name}/tarball/${encodeURIComponent(ref)}`;
  const response = await fetch(url, {
    headers: headers(opts?.token),
    redirect: 'follow',
  });

  if (response.status === 403) {
    handleRateLimit(response);
    throw new IngestionError(
      `Access denied for "${owner}/${name}". The repository may be private — authenticate via GitHub to access it.`,
      'ACCESS_DENIED',
      403,
    );
  }

  if (!response.ok) {
    throw new IngestionError(
      `Failed to download tarball for "${owner}/${name}" at ref "${ref}": ${response.status}`,
      'TARBALL_DOWNLOAD_ERROR',
      response.status,
    );
  }

  return response.arrayBuffer();
};
