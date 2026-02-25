import { IngestionError } from '@wikismith/shared';

export interface ParsedRepo {
  owner: string;
  name: string;
  ref?: string;
}

const GITHUB_URL_RE =
  /^(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?(?:\/(?:tree|blob)\/([^\s?#]+?))?(?:\/)?(?:[?#].*)?$/;

const SHORTHAND_RE = /^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/;

export const parseGitHubUrl = (input: string): ParsedRepo => {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new IngestionError('Repository URL is required', 'EMPTY_URL', 400);
  }

  const urlMatch = GITHUB_URL_RE.exec(trimmed);
  if (urlMatch) {
    const ref = extractRef(trimmed, urlMatch[3]);
    return {
      owner: urlMatch[1]!,
      name: urlMatch[2]!,
      ...(ref ? { ref } : {}),
    };
  }

  const shortMatch = SHORTHAND_RE.exec(trimmed);
  if (shortMatch) {
    return {
      owner: shortMatch[1]!,
      name: shortMatch[2]!,
    };
  }

  throw new IngestionError(
    `Invalid GitHub URL: "${trimmed}". Expected format: https://github.com/owner/repo or owner/repo`,
    'INVALID_URL',
    400,
  );
};

const extractRef = (url: string, pathRef?: string): string | undefined => {
  if (pathRef) return pathRef;

  try {
    const parsed = new URL(url);
    const refParam = parsed.searchParams.get('ref');
    if (refParam) return refParam;

    // Hash fragments in GitHub URLs are for line numbers (#L42) or anchors (#readme), not refs
  } catch {
    // Not a valid URL — shorthand, no ref to extract
  }

  return undefined;
};
