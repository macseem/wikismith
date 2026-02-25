import type { IAnalysisResult, IClassifiedFeatureTree, IFeatureNode } from '@wikismith/shared';
import { AnalysisError } from '@wikismith/shared';
import OpenAI from 'openai';

const MAX_FILES_PER_CHUNK = 100;
const MAX_TOP_LEVEL_FEATURES = 12;

export interface ClassifyOptions {
  openaiApiKey?: string;
  model?: string;
  maxFeatures?: number;
  commitSha?: string;
}

const buildClassificationPrompt = (
  analysis: IAnalysisResult,
  startIdx: number,
  endIdx: number,
): string => {
  const fileSlice = analysis.files.slice(startIdx, endIdx);
  const fileList = fileSlice
    .map(
      (f) =>
        `- ${f.path} (${f.language ?? 'unknown'}, importance: ${f.importanceScore}, ${f.isEntryPoint ? 'ENTRY POINT' : ''}) exports: [${f.signatures.join(', ')}]`,
    )
    .join('\n');

  const frameworks = analysis.frameworks.join(', ') || 'none detected';
  const languages = Object.entries(analysis.languages)
    .map(([lang, count]) => `${lang}: ${count} files`)
    .join(', ');

  return `You are analyzing a codebase to identify USER-FACING FEATURES (not technical layers).

## Repository Context
- Languages: ${languages}
- Frameworks: ${frameworks}
- Entry points: ${analysis.entryPoints.join(', ')}
- Total files in this batch: ${fileSlice.length}

## Files
${fileList}

## Instructions
Classify these files into user-facing features. Rules:
1. Features must describe WHAT the software does for users (e.g., "Authentication", "Dashboard Analytics", "Export to PDF"), NOT technical layers (e.g., "Frontend", "API", "Utils").
2. Each feature needs: name, description, and relevant files with their role.
3. A file can belong to multiple features.
4. Support 2 levels: top-level features and optional sub-features.
5. Return a maximum of ${MAX_TOP_LEVEL_FEATURES} top-level features.
6. For CLI tools, use commands as features. For libraries, use public API modules.

Respond with ONLY valid JSON matching this schema:
{
  "features": [
    {
      "id": "feature-slug",
      "name": "Feature Name",
      "description": "What this feature does for users",
      "relevantFiles": [
        { "path": "src/auth/login.ts", "role": "Handles user login form submission" }
      ],
      "children": []
    }
  ]
}`;
};

export const classify = async (
  analysis: IAnalysisResult,
  repoId?: string,
  opts?: ClassifyOptions,
): Promise<IClassifiedFeatureTree> => {
  const openai = new OpenAI({ apiKey: opts?.openaiApiKey ?? process.env['OPENAI_API_KEY'] });
  const model = opts?.model ?? 'gpt-4o-mini';

  const allFeatures: IFeatureNode[] = [];
  const totalFiles = analysis.files.length;
  const errors: Array<{ chunkIndex: number; error: string }> = [];

  for (let i = 0; i < totalFiles; i += MAX_FILES_PER_CHUNK) {
    const end = Math.min(i + MAX_FILES_PER_CHUNK, totalFiles);
    const prompt = buildClassificationPrompt(analysis, i, end);

    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) continue;

    try {
      const parsed = JSON.parse(content) as { features: IFeatureNode[] };
      allFeatures.push(...parsed.features);
    } catch (err) {
      const chunkIndex = Math.floor(i / MAX_FILES_PER_CHUNK);
      const message = err instanceof Error ? err.message : 'Unknown parse error';
      errors.push({ chunkIndex, error: message });
      console.error(
        `[classify] Failed to parse LLM response for chunk ${chunkIndex} (files ${i}-${end}): ${message}`,
      );
    }
  }

  if (allFeatures.length === 0 && errors.length > 0) {
    throw new AnalysisError(
      `Classification failed: all ${errors.length} chunk(s) returned unparseable responses`,
      'CLASSIFICATION_FAILED',
      500,
      { errors },
    );
  }

  const merged = mergeFeatures(allFeatures);

  return {
    repoId: repoId ?? 'unknown',
    commitSha: opts?.commitSha ?? '',
    features: merged.slice(0, opts?.maxFeatures ?? MAX_TOP_LEVEL_FEATURES),
    generatedAt: new Date().toISOString(),
  };
};

const mergeFeatures = (features: IFeatureNode[]): IFeatureNode[] => {
  const byId = new Map<string, IFeatureNode>();

  for (const feature of features) {
    const existing = byId.get(feature.id);
    if (existing) {
      const existingPaths = new Set(existing.relevantFiles.map((f) => f.path));
      for (const file of feature.relevantFiles) {
        if (!existingPaths.has(file.path)) {
          existing.relevantFiles.push(file);
        }
      }
      if (feature.children.length > 0) {
        existing.children.push(...feature.children);
      }
    } else {
      byId.set(feature.id, { ...feature });
    }
  }

  return [...byId.values()];
};
