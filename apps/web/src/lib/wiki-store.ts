import type { IWikiPage, IClassifiedFeatureTree } from '@wikismith/shared';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join, resolve, sep } from 'path';

export interface StoredWiki {
  generatedByWorkosId?: string;
  owner: string;
  repo: string;
  commitSha: string;
  pages: IWikiPage[];
  featureTree: IClassifiedFeatureTree;
  analysis: {
    languages: Record<string, number>;
    frameworks: string[];
    fileCount: number;
  };
  createdAt: string;
}

const CACHE_DIR = join(process.cwd(), '.wikismith-cache');

const ensureCacheDir = () => {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
};

const sanitize = (input: string): string => input.replace(/[^a-zA-Z0-9._-]/g, '');

const filePath = (owner: string, repo: string) => {
  const name = `${sanitize(owner.toLowerCase())}__${sanitize(repo.toLowerCase())}.json`;
  const resolved = resolve(CACHE_DIR, name);
  if (!resolved.startsWith(CACHE_DIR + sep)) {
    throw new Error('Invalid owner/repo');
  }
  return resolved;
};

export const saveWiki = (wiki: StoredWiki): void => {
  ensureCacheDir();
  writeFileSync(filePath(wiki.owner, wiki.repo), JSON.stringify(wiki), 'utf-8');
};

export const getWiki = (owner: string, repo: string): StoredWiki | undefined => {
  const path = filePath(owner, repo);
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as StoredWiki;
  } catch {
    return undefined;
  }
};

export const hasWiki = (owner: string, repo: string): boolean => existsSync(filePath(owner, repo));

export const deleteWiki = (owner: string, repo: string, workosUserId?: string): boolean => {
  const path = filePath(owner, repo);
  if (!existsSync(path)) {
    return false;
  }

  if (workosUserId) {
    const wiki = getWiki(owner, repo);
    if (wiki?.generatedByWorkosId && wiki.generatedByWorkosId !== workosUserId) {
      return false;
    }
  }

  try {
    unlinkSync(path);
    return true;
  } catch {
    return false;
  }
};

interface ListRecentWikisOptions {
  limit?: number;
  workosUserId?: string;
}

export const listRecentWikis = ({
  limit = 10,
  workosUserId,
}: ListRecentWikisOptions = {}): StoredWiki[] => {
  if (!existsSync(CACHE_DIR)) {
    return [];
  }

  const entries = readdirSync(CACHE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => join(CACHE_DIR, entry.name));

  const parsed = entries
    .map((path) => {
      try {
        return JSON.parse(readFileSync(path, 'utf-8')) as StoredWiki;
      } catch {
        return null;
      }
    })
    .filter((wiki): wiki is StoredWiki => wiki !== null)
    .filter((wiki) => (workosUserId ? wiki.generatedByWorkosId === workosUserId : true))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return parsed.slice(0, limit);
};
