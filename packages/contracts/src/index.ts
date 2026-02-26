import { z } from 'zod';

const citationSchema = z.object({
  text: z.string(),
  filePath: z.string(),
  startLine: z.number().int().nonnegative(),
  endLine: z.number().int().nonnegative(),
  url: z.string().url(),
});

const wikiPageSchema = z.object({
  id: z.string(),
  featureId: z.string(),
  slug: z.string(),
  title: z.string(),
  content: z.string(),
  citations: z.array(citationSchema),
  parentPageId: z.string().nullable(),
  order: z.number().int().nonnegative(),
});

interface ContractFeatureNode {
  id: string;
  name: string;
  description: string;
  relevantFiles: Array<{ path: string; role: string }>;
  children: ContractFeatureNode[];
}

const featureNodeSchema: z.ZodType<ContractFeatureNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    relevantFiles: z.array(
      z.object({
        path: z.string(),
        role: z.string(),
      }),
    ),
    children: z.array(featureNodeSchema),
  }),
);

const classifiedFeatureTreeSchema = z.object({
  repoId: z.string(),
  commitSha: z.string(),
  features: z.array(featureNodeSchema),
  generatedAt: z.string(),
});

const wikiAnalysisSchema = z.object({
  languages: z.record(z.number()),
  frameworks: z.array(z.string()),
  fileCount: z.number().int().nonnegative(),
});

const storedWikiSchema = z.object({
  generatedByWorkosId: z.string().optional(),
  owner: z.string(),
  repo: z.string(),
  branch: z.string().optional(),
  commitSha: z.string(),
  pages: z.array(wikiPageSchema),
  featureTree: classifiedFeatureTreeSchema,
  analysis: wikiAnalysisSchema,
  createdAt: z.string(),
});

const ownerRepoParamsSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
});

const apiErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  signInPath: z.string().optional(),
  reauthPath: z.string().optional(),
  statusCode: z.number().int().optional(),
  used: z.number().int().nonnegative().optional(),
  limit: z.number().int().nonnegative().optional(),
  resetAt: z.string().optional(),
});

const generateWikiRequestSchema = z.object({
  url: z.string().min(1),
  ref: z.string().optional(),
  force: z.boolean().optional(),
});

const generateWikiResponseSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  commitSha: z.string(),
  cached: z.boolean(),
});

const generateWikiProgressEventSchema = z.object({
  stage: z.string(),
  message: z.string(),
  total: z.number().int().positive().optional(),
  completed: z.number().int().nonnegative().optional(),
});

export const apiContracts = {
  common: {
    error: apiErrorSchema,
  },
  wiki: {
    get: {
      params: ownerRepoParamsSchema,
      response: storedWikiSchema,
      error: apiErrorSchema,
    },
  },
  generate: {
    post: {
      body: generateWikiRequestSchema,
      response: generateWikiResponseSchema,
      error: apiErrorSchema,
      sse: {
        progress: generateWikiProgressEventSchema,
        complete: generateWikiResponseSchema,
        error: apiErrorSchema,
      },
    },
  },
} as const;

export type ApiError = z.infer<typeof apiErrorSchema>;
export type StoredWikiContract = z.infer<typeof storedWikiSchema>;
export type GenerateWikiRequest = z.infer<typeof generateWikiRequestSchema>;
export type GenerateWikiResponse = z.infer<typeof generateWikiResponseSchema>;
export type GenerateWikiProgressEvent = z.infer<typeof generateWikiProgressEventSchema>;
