export interface IIngestionResult {
  repo: {
    owner: string;
    name: string;
    defaultBranch: string;
    isPrivate: boolean;
  };
  ref: string;
  commitSha: string;
  fileTree: string[];
  files: Record<string, string>;
  readme: { path: string; content: string } | null;
  manifests: Array<{ path: string; content: string }>;
  languageBreakdown: Record<string, { files: number; lines?: number }>;
  metadata: {
    fetchedAt: string;
    strategy: 'tarball' | 'api' | 'clone';
    totalFiles: number;
    totalSizeBytes: number;
  };
}
