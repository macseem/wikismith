import type { IIngestionResult } from '@wikismith/shared';

const ENTRY_POINT_PATTERNS: Array<{ re: RegExp; weight: number }> = [
  { re: /^(?:src\/)?index\.[jt]sx?$/, weight: 10 },
  { re: /^(?:src\/)?main\.[jt]sx?$/, weight: 10 },
  { re: /^(?:src\/)?app\.[jt]sx?$/, weight: 9 },
  { re: /^(?:src\/)?server\.[jt]sx?$/, weight: 9 },
  { re: /^(?:src\/)?cli\.[jt]sx?$/, weight: 8 },
  { re: /^(?:src\/)?bin\//, weight: 7 },
  { re: /^main\.py$/, weight: 10 },
  { re: /^app\.py$/, weight: 9 },
  { re: /^manage\.py$/, weight: 8 },
  { re: /^main\.go$/, weight: 10 },
  { re: /^cmd\//, weight: 8 },
  { re: /^src\/main\.rs$/, weight: 10 },
  { re: /^src\/lib\.rs$/, weight: 9 },
];

export const findEntryPoints = (ingestion: IIngestionResult): string[] => {
  const scored = ingestion.fileTree
    .map((path) => {
      const match = ENTRY_POINT_PATTERNS.find((p) => p.re.test(path));
      return match ? { path, weight: match.weight } : null;
    })
    .filter(Boolean) as Array<{ path: string; weight: number }>;

  scored.sort((a, b) => b.weight - a.weight);
  return scored.map((s) => s.path);
};

export const findPackageEntryPoints = (ingestion: IIngestionResult): string[] => {
  const entries: string[] = [];

  for (const manifest of ingestion.manifests) {
    if (!manifest.path.endsWith('package.json')) continue;
    try {
      const pkg = JSON.parse(manifest.content) as Record<string, unknown>;
      const main = pkg['main'] as string | undefined;
      const module_ = pkg['module'] as string | undefined;
      const candidate = main ?? module_;
      if (candidate && typeof candidate === 'string') {
        const dir = manifest.path.includes('/')
          ? manifest.path.slice(0, manifest.path.lastIndexOf('/') + 1)
          : '';
        const normalized = candidate.startsWith('./') ? candidate.slice(2) : candidate;
        entries.push(dir + normalized);
      }
    } catch (err) {
      console.error(`[entry-points] Failed to parse ${manifest.path}:`, err);
    }
  }

  return entries;
};
