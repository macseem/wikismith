import type { IAnalysisResult, IFileEntry, IIngestionResult } from '@wikismith/shared';
import { extname } from 'node:path';
import { detectFrameworks } from './detect-framework';
import { findEntryPoints, findPackageEntryPoints } from './entry-points';
import { buildImportGraph } from './import-graph';
import { extractSignatures } from './signatures';
import { computeImportance } from './importance';
import { LANGUAGE_MAP } from '../ingestion/constants';

export const analyze = (ingestion: IIngestionResult): IAnalysisResult => {
  const frameworks = detectFrameworks(ingestion);
  const entryPoints = [
    ...new Set([...findEntryPoints(ingestion), ...findPackageEntryPoints(ingestion)]),
  ];
  const importGraph = buildImportGraph(ingestion);
  const entrySet = new Set(entryPoints);

  const files: IFileEntry[] = [];
  const fileCount = Object.keys(ingestion.files).length;

  for (const [filePath, content] of Object.entries(ingestion.files)) {
    const ext = extname(filePath).toLowerCase();
    const language = LANGUAGE_MAP[ext] ?? null;
    const sizeBytes = Buffer.byteLength(content, 'utf-8');
    const signatures = extractSignatures(filePath, content);
    const isEntryPoint = entrySet.has(filePath);
    const importanceScore = computeImportance({
      filePath,
      isEntryPoint,
      edges: importGraph,
      signatures,
      fileCount,
    });

    files.push({
      path: filePath,
      language,
      sizeBytes,
      isEntryPoint,
      importanceScore,
      signatures: signatures
        .filter((s) => s.exported)
        .map((s) => `${s.kind} ${s.name}`),
    });
  }

  files.sort((a, b) => b.importanceScore - a.importanceScore);

  const documentation = ingestion.readme
    ? [{ path: ingestion.readme.path, content: ingestion.readme.content }]
    : [];

  return {
    files,
    importGraph,
    languages: Object.fromEntries(
      Object.entries(ingestion.languageBreakdown).map(([lang, data]) => [lang, data.files]),
    ),
    frameworks,
    entryPoints,
    documentation,
  };
};
