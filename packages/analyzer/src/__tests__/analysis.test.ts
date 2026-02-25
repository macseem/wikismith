import { describe, expect, it } from 'vitest';
import type { IIngestionResult } from '@wikismith/shared';
import { analyze } from '../analysis';

const makeIngestion = (overrides: Partial<IIngestionResult> = {}): IIngestionResult => ({
  repo: { owner: 'test', name: 'repo', defaultBranch: 'main', isPrivate: false },
  ref: 'main',
  commitSha: 'abc123',
  fileTree: Object.keys(overrides.files ?? { 'src/index.ts': '' }),
  files: { 'src/index.ts': 'export const hello = () => "world";' },
  readme: { path: 'README.md', content: '# Test' },
  manifests: [
    {
      path: 'package.json',
      content: JSON.stringify({
        name: 'test',
        dependencies: { react: '^18.0.0', next: '^14.0.0' },
      }),
    },
  ],
  languageBreakdown: { TypeScript: { files: 1, lines: 1 } },
  metadata: {
    fetchedAt: new Date().toISOString(),
    strategy: 'tarball',
    totalFiles: 1,
    totalSizeBytes: 100,
  },
  ...overrides,
});

describe('analyze', () => {
  it('detects frameworks from package.json', () => {
    const result = analyze(makeIngestion());
    expect(result.frameworks).toContain('Next.js');
    expect(result.frameworks).toContain('React');
  });

  it('identifies entry points', () => {
    const files = {
      'src/index.ts': 'export const main = () => {};',
      'src/utils.ts': 'export const helper = () => {};',
    };
    const result = analyze(
      makeIngestion({ files, fileTree: Object.keys(files) }),
    );
    expect(result.entryPoints).toContain('src/index.ts');
  });

  it('builds import graph for relative imports', () => {
    const files = {
      'src/index.ts': "import { helper } from './utils';",
      'src/utils.ts': 'export const helper = () => {};',
    };
    const result = analyze(
      makeIngestion({ files, fileTree: Object.keys(files) }),
    );
    expect(result.importGraph).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'src/index.ts', target: 'src/utils.ts' }),
      ]),
    );
  });

  it('extracts signatures for exported functions', () => {
    const files = {
      'src/api.ts': 'export function fetchData() {}\nexport class UserService {}\nconst internal = 1;',
    };
    const result = analyze(
      makeIngestion({ files, fileTree: Object.keys(files) }),
    );
    const apiFile = result.files.find((f) => f.path === 'src/api.ts');
    expect(apiFile?.signatures).toContain('function fetchData');
    expect(apiFile?.signatures).toContain('class UserService');
    expect(apiFile?.signatures).not.toContain('variable internal');
  });

  it('assigns higher importance to entry points', () => {
    const files = {
      'src/index.ts': 'export const main = () => {};',
      'src/helpers/utils.ts': 'const x = 1;',
    };
    const result = analyze(
      makeIngestion({ files, fileTree: Object.keys(files) }),
    );
    const index = result.files.find((f) => f.path === 'src/index.ts');
    const utils = result.files.find((f) => f.path === 'src/helpers/utils.ts');
    expect(index!.importanceScore).toBeGreaterThan(utils!.importanceScore);
  });

  it('includes documentation from README', () => {
    const result = analyze(makeIngestion());
    expect(result.documentation).toHaveLength(1);
    expect(result.documentation[0]?.path).toBe('README.md');
  });

  it('reports languages from breakdown', () => {
    const result = analyze(makeIngestion());
    expect(result.languages).toHaveProperty('TypeScript', 1);
  });

  it('sorts files by importance descending', () => {
    const files = {
      'src/index.ts': 'export const main = () => {};',
      'vitest.config.ts': 'export default {};',
      'src/routes/api.ts': 'export function handler() {}',
    };
    const result = analyze(
      makeIngestion({ files, fileTree: Object.keys(files) }),
    );
    const scores = result.files.map((f) => f.importanceScore);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });
});
