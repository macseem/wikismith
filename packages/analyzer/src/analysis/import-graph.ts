import type { IImportEdge, IIngestionResult } from '@wikismith/shared';
import { dirname, resolve, extname } from 'node:path';

const JS_IMPORT_RE = /(?:import|export)\s+.*?from\s+['"]([^'"]+)['"]/g;
const JS_REQUIRE_RE = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const PY_IMPORT_RE = /^(?:from\s+(\S+)\s+import|import\s+(\S+))/gm;

const isRelative = (specifier: string): boolean =>
  specifier.startsWith('./') || specifier.startsWith('../');

const resolveRelativeImport = (
  sourceDir: string,
  specifier: string,
  fileTree: Set<string>,
): string | null => {
  const resolved = resolve('/' + sourceDir, specifier).slice(1);
  const candidates = [
    resolved,
    resolved + '.ts',
    resolved + '.tsx',
    resolved + '.js',
    resolved + '.jsx',
    resolved + '/index.ts',
    resolved + '/index.tsx',
    resolved + '/index.js',
    resolved + '/index.jsx',
  ];

  return candidates.find((c) => fileTree.has(c)) ?? null;
};

export const buildImportGraph = (ingestion: IIngestionResult): IImportEdge[] => {
  const edges: IImportEdge[] = [];
  const fileSet = new Set(ingestion.fileTree);

  for (const [filePath, content] of Object.entries(ingestion.files)) {
    const ext = extname(filePath).toLowerCase();
    const sourceDir = dirname(filePath);

    if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
      for (const re of [JS_IMPORT_RE, JS_REQUIRE_RE]) {
        re.lastIndex = 0;
        let match;
        while ((match = re.exec(content)) !== null) {
          const specifier = match[1];
          if (!specifier || !isRelative(specifier)) continue;
          const target = resolveRelativeImport(sourceDir, specifier, fileSet);
          if (target && target !== filePath) {
            edges.push({ source: filePath, target });
          }
        }
      }
    }

    if (ext === '.py') {
      PY_IMPORT_RE.lastIndex = 0;
      let match;
      while ((match = PY_IMPORT_RE.exec(content)) !== null) {
        const module = match[1] ?? match[2];
        if (!module) continue;
        const asPath = module.replace(/\./g, '/') + '.py';
        if (fileSet.has(asPath) && asPath !== filePath) {
          edges.push({ source: filePath, target: asPath });
        }
      }
    }
  }

  return edges;
};
