import type { IWikiPage, IClassifiedFeatureTree } from '@wikismith/shared';

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

const store = new Map<string, StoredWiki>();

const key = (owner: string, repo: string) => `${owner}/${repo}`;

export const saveWiki = (wiki: StoredWiki): void => {
  store.set(key(wiki.owner, wiki.repo), wiki);
};

export const getWiki = (owner: string, repo: string): StoredWiki | undefined =>
  store.get(key(owner, repo));

export const hasWiki = (owner: string, repo: string): boolean =>
  store.has(key(owner, repo));
