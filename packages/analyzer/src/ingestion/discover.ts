import { basename, extname } from 'node:path';
import type { ExtractedFile } from './extract';
import { LANGUAGE_MAP, MANIFEST_FILES, README_PATTERNS } from './constants';

export const findReadme = (
  files: ExtractedFile[],
): { path: string; content: string } | null => {
  for (const file of files) {
    const name = basename(file.path);
    const depth = file.path.split('/').length;
    if (depth === 1 && README_PATTERNS.some((re) => re.test(name)) && file.content) {
      return { path: file.path, content: file.content };
    }
  }
  return null;
};

export const findManifests = (
  files: ExtractedFile[],
): Array<{ path: string; content: string }> =>
  files
    .filter((f) => {
      const name = basename(f.path).toLowerCase();
      return MANIFEST_FILES.has(name) && f.content != null;
    })
    .map((f) => ({ path: f.path, content: f.content! }));

export const computeLanguageBreakdown = (
  files: ExtractedFile[],
): Record<string, { files: number; lines?: number }> => {
  const breakdown: Record<string, { files: number; lines: number }> = {};

  for (const file of files) {
    if (file.isBinary || file.content == null) continue;

    const ext = extname(file.path).toLowerCase();
    const lang = LANGUAGE_MAP[ext];
    if (!lang) continue;

    if (!breakdown[lang]) {
      breakdown[lang] = { files: 0, lines: 0 };
    }
    breakdown[lang]!.files += 1;
    breakdown[lang]!.lines += file.content.split('\n').length;
  }

  return breakdown;
};

export const buildFilesMap = (files: ExtractedFile[]): Record<string, string> => {
  const map: Record<string, string> = {};
  for (const file of files) {
    if (file.content != null) {
      map[file.path] = file.content;
    }
  }
  return map;
};
