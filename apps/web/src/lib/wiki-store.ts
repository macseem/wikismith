import type { IWikiPage, IClassifiedFeatureTree } from '@wikismith/shared';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, resolve, sep } from 'path';

export interface StoredWiki {
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

export const hasWiki = (owner: string, repo: string): boolean =>
  existsSync(filePath(owner, repo));
