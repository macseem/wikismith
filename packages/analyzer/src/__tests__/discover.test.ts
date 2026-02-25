import { describe, expect, it } from 'vitest';
import { findReadme, findManifests, computeLanguageBreakdown, buildFilesMap } from '../ingestion/discover';
import type { ExtractedFile } from '../ingestion/extract';

const makeFile = (path: string, content: string | null = 'content', isBinary = false): ExtractedFile => ({
  path,
  content,
  sizeBytes: content?.length ?? 0,
  isBinary,
});

describe('findReadme', () => {
  it('finds README.md at root', () => {
    const files = [makeFile('README.md', '# Hello'), makeFile('src/index.ts')];
    const result = findReadme(files);
    expect(result).toEqual({ path: 'README.md', content: '# Hello' });
  });

  it('finds case-insensitive readme', () => {
    const files = [makeFile('readme.txt', 'hello')];
    expect(findReadme(files)).toEqual({ path: 'readme.txt', content: 'hello' });
  });

  it('ignores nested README', () => {
    const files = [makeFile('docs/README.md', '# Docs')];
    expect(findReadme(files)).toBeNull();
  });

  it('returns null when no README', () => {
    const files = [makeFile('src/index.ts')];
    expect(findReadme(files)).toBeNull();
  });
});

describe('findManifests', () => {
  it('finds package.json', () => {
    const files = [makeFile('package.json', '{}')];
    expect(findManifests(files)).toEqual([{ path: 'package.json', content: '{}' }]);
  });

  it('finds nested manifests', () => {
    const files = [makeFile('packages/core/package.json', '{}'), makeFile('go.mod', 'module foo')];
    expect(findManifests(files)).toHaveLength(2);
  });

  it('skips manifests without content', () => {
    const files = [makeFile('package.json', null)];
    expect(findManifests(files)).toHaveLength(0);
  });
});

describe('computeLanguageBreakdown', () => {
  it('counts languages by extension', () => {
    const files = [
      makeFile('src/index.ts', 'const x = 1;\nconst y = 2;'),
      makeFile('src/utils.ts', 'export const z = 3;'),
      makeFile('src/styles.css', '.foo { }'),
    ];
    const result = computeLanguageBreakdown(files);
    expect(result['TypeScript']?.files).toBe(2);
    expect(result['TypeScript']?.lines).toBe(3);
    expect(result['CSS']?.files).toBe(1);
  });

  it('skips binary files', () => {
    const files = [makeFile('logo.png', null, true)];
    expect(computeLanguageBreakdown(files)).toEqual({});
  });
});

describe('buildFilesMap', () => {
  it('maps path to content', () => {
    const files = [makeFile('a.ts', 'code'), makeFile('b.png', null, true)];
    const result = buildFilesMap(files);
    expect(result).toEqual({ 'a.ts': 'code' });
  });
});
