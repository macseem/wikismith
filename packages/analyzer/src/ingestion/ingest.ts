import type { IIngestionResult } from '@wikismith/shared';
import { parseGitHubUrl } from './parse-url';
import { fetchRepoMetadata, resolveCommitSha, downloadTarball } from './github-client';
import { extractTarball } from './extract';
import { findReadme, findManifests, computeLanguageBreakdown, buildFilesMap } from './discover';

export interface IngestOptions {
  token?: string;
  ref?: string;
}

export const ingest = async (repoUrl: string, opts?: IngestOptions): Promise<IIngestionResult> => {
  const parsed = parseGitHubUrl(repoUrl);
  const clientOpts = { token: opts?.token };

  const metadata = await fetchRepoMetadata(parsed.owner, parsed.name, clientOpts);
  const targetRef = opts?.ref ?? parsed.ref ?? metadata.defaultBranch;
  const commitSha = await resolveCommitSha(parsed.owner, parsed.name, targetRef, clientOpts);
  const tarball = await downloadTarball(parsed.owner, parsed.name, commitSha, clientOpts);
  const { files, fileTree, totalSizeBytes } = await extractTarball(tarball);

  return {
    repo: {
      owner: metadata.owner,
      name: metadata.name,
      defaultBranch: metadata.defaultBranch,
      isPrivate: metadata.isPrivate,
    },
    ref: targetRef,
    commitSha,
    fileTree,
    files: buildFilesMap(files),
    readme: findReadme(files),
    manifests: findManifests(files),
    languageBreakdown: computeLanguageBreakdown(files),
    metadata: {
      fetchedAt: new Date().toISOString(),
      strategy: 'tarball' as const,
      totalFiles: fileTree.length,
      totalSizeBytes,
    },
  };
};
