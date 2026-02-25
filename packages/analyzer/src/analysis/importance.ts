import type { IImportEdge } from '@wikismith/shared';
import type { Signature } from './signatures';

const BOILERPLATE_PATTERNS = [
  /\.config\.[jt]sx?$/,
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /__tests__\//,
  /\.d\.ts$/,
  /\.stories\.[jt]sx?$/,
  /\.storybook\//,
  /jest\.config/,
  /vitest\.config/,
  /tsconfig.*\.json$/,
  /eslint/,
  /prettier/,
  /\.env/,
];

const FEATURE_SIGNAL_PATTERNS = [
  { re: /\/(?:routes?|pages?|api)\//i, boost: 3 },
  { re: /\/(?:components?|views?)\//i, boost: 2 },
  { re: /\/(?:services?|controllers?|handlers?)\//i, boost: 2 },
  { re: /\/(?:hooks?|composables?)\//i, boost: 1.5 },
  { re: /\/(?:models?|entities?|schemas?)\//i, boost: 1.5 },
  { re: /index\.[jt]sx?$/, boost: 1.5 },
];

export interface ImportanceInput {
  filePath: string;
  isEntryPoint: boolean;
  edges: IImportEdge[];
  signatures: Signature[];
  fileCount: number;
}

export const computeImportance = ({
  filePath,
  isEntryPoint,
  edges,
  signatures,
  fileCount,
}: ImportanceInput): number => {
  if (BOILERPLATE_PATTERNS.some((re) => re.test(filePath))) return 0.1;

  let score = 0.3;

  if (isEntryPoint) score += 0.4;

  const incomingEdges = edges.filter((e) => e.target === filePath).length;
  const incomingRatio = fileCount > 0 ? incomingEdges / fileCount : 0;
  score += Math.min(incomingRatio * 5, 0.3);

  const exportedCount = signatures.filter((s) => s.exported).length;
  score += Math.min(exportedCount * 0.02, 0.15);

  for (const signal of FEATURE_SIGNAL_PATTERNS) {
    if (signal.re.test(filePath)) {
      score *= signal.boost;
      break;
    }
  }

  return Math.min(Math.round(score * 100) / 100, 1);
};
