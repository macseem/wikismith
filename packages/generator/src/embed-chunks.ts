import { decode, encode } from 'gpt-tokenizer';
import OpenAI from 'openai';

export interface IPageForEmbedding {
  pageId: string;
  title: string;
  content: string;
}

export interface IChunkWikiPagesInput {
  pages: IPageForEmbedding[];
  minTokens?: number;
  maxTokens?: number;
  overlapTokens?: number;
}

export interface IChunkedWikiSection {
  pageId: string;
  sectionHeading: string;
  chunkText: string;
  chunkIndex: number;
  tokenCount: number;
}

export interface IEmbeddedWikiSection extends IChunkedWikiSection {
  embedding: number[];
}

export interface IEmbedChunksInput extends IChunkWikiPagesInput {
  openaiApiKey?: string;
  model?: string;
  batchSize?: number;
}

interface IEmbeddingClient {
  embeddings: {
    create: (params: { model: string; input: string[] }) => Promise<{
      data: Array<{
        embedding: number[];
      }>;
    }>;
  };
}

interface ISection {
  heading: string;
  content: string;
}

interface ITokenWithHeading {
  tokenId: number;
  heading: string;
}

const DEFAULT_MIN_TOKENS = 500;
const DEFAULT_MAX_TOKENS = 1000;
const DEFAULT_OVERLAP_TOKENS = 100;
const DEFAULT_BATCH_SIZE = 2048;
const MAX_EMBEDDING_RETRIES = 3;
const EMBEDDING_RETRY_BASE_DELAY_MS = 300;

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const getErrorStatusCode = (error: unknown): number | null => {
  if (!error || typeof error !== 'object' || !('status' in error)) {
    return null;
  }

  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : null;
};

const isRetryableEmbeddingError = (error: unknown): boolean => {
  const status = getErrorStatusCode(error);
  return status === 429 || (status !== null && status >= 500 && status < 600);
};

const createEmbeddingsWithRetry = async (
  openai: OpenAI,
  model: string,
  input: string[],
): Promise<{
  data: Array<{
    embedding: number[];
  }>;
}> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_EMBEDDING_RETRIES; attempt += 1) {
    try {
      const response = await openai.embeddings.create({ model, input });
      return {
        data: response.data.map((entry) => ({
          embedding: entry.embedding,
        })),
      };
    } catch (error) {
      lastError = error;

      if (!isRetryableEmbeddingError(error) || attempt === MAX_EMBEDDING_RETRIES) {
        throw new Error('Failed to create embeddings from OpenAI API.', { cause: error });
      }

      await sleep(EMBEDDING_RETRY_BASE_DELAY_MS * 2 ** attempt);
    }
  }

  throw new Error('Failed to create embeddings from OpenAI API.', { cause: lastError });
};

const extractSections = (pageTitle: string, markdown: string): ISection[] => {
  const lines = markdown.split(/\r?\n/);
  const sections: ISection[] = [];
  let currentHeading = pageTitle;
  let buffer: string[] = [];

  const flush = () => {
    const content = buffer.join('\n').trim();
    if (!content) {
      return;
    }

    sections.push({
      heading: currentHeading,
      content,
    });
  };

  lines.forEach((line) => {
    const match = line.match(/^#{2,3}\s+(.+)$/);
    if (match) {
      flush();
      currentHeading = match[1]?.trim() || pageTitle;
      buffer = [currentHeading];
      return;
    }

    buffer.push(line);
  });

  flush();

  if (sections.length === 0) {
    const content = markdown.trim();
    if (content.length > 0) {
      sections.push({
        heading: pageTitle,
        content,
      });
    }
  }

  return sections;
};

const flattenSectionsToTokens = (sections: ISection[]): ITokenWithHeading[] =>
  sections.flatMap((section) =>
    encode(section.content).map((tokenId) => ({
      tokenId,
      heading: section.heading,
    })),
  );

const decodeTokens = (tokens: ITokenWithHeading[]): string =>
  decode(tokens.map((token) => token.tokenId));

const clampBatchSize = (batchSize?: number): number => {
  if (!batchSize || Number.isNaN(batchSize)) {
    return DEFAULT_BATCH_SIZE;
  }

  return Math.min(Math.max(1, Math.floor(batchSize)), DEFAULT_BATCH_SIZE);
};

const createEmbeddingClient = (apiKey: string): IEmbeddingClient => {
  const openai = new OpenAI({ apiKey });

  return {
    embeddings: {
      create: async ({ model, input }) => createEmbeddingsWithRetry(openai, model, input),
    },
  };
};

export const chunkWikiPages = (input: IChunkWikiPagesInput): IChunkedWikiSection[] => {
  const minTokens = Math.max(1, Math.floor(input.minTokens ?? DEFAULT_MIN_TOKENS));
  const maxTokens = Math.max(minTokens, Math.floor(input.maxTokens ?? DEFAULT_MAX_TOKENS));
  const overlapTokens = Math.max(
    0,
    Math.min(maxTokens - 1, Math.floor(input.overlapTokens ?? DEFAULT_OVERLAP_TOKENS)),
  );
  const stride = Math.max(1, maxTokens - overlapTokens);

  const chunks: IChunkedWikiSection[] = [];

  input.pages.forEach((page) => {
    const sections = extractSections(page.title, page.content);
    const tokens = flattenSectionsToTokens(sections);

    if (tokens.length === 0) {
      return;
    }

    if (tokens.length <= maxTokens) {
      const firstToken = tokens.at(0);

      chunks.push({
        pageId: page.pageId,
        sectionHeading: firstToken ? firstToken.heading : page.title,
        chunkText: decodeTokens(tokens),
        chunkIndex: 0,
        tokenCount: tokens.length,
      });
      return;
    }

    let start = 0;
    let chunkIndex = 0;

    while (start < tokens.length) {
      const end = Math.min(tokens.length, start + maxTokens);
      const window = tokens.slice(start, end);

      if (window.length === 0) {
        break;
      }

      if (window.length < minTokens && chunks.length > 0) {
        const lastChunk = chunks[chunks.length - 1];
        if (lastChunk?.pageId === page.pageId) {
          const merged = `${lastChunk.chunkText}\n\n${decodeTokens(window)}`.trim();
          lastChunk.chunkText = merged;
          lastChunk.tokenCount += window.length;
          break;
        }
      }

      const firstWindowToken = window.at(0);

      chunks.push({
        pageId: page.pageId,
        sectionHeading: firstWindowToken ? firstWindowToken.heading : page.title,
        chunkText: decodeTokens(window),
        chunkIndex,
        tokenCount: window.length,
      });

      if (end >= tokens.length) {
        break;
      }

      start += stride;
      chunkIndex += 1;
    }
  });

  return chunks;
};

export const embedChunks = async (
  input: IEmbedChunksInput,
  options?: { client?: IEmbeddingClient },
): Promise<IEmbeddedWikiSection[]> => {
  const chunks = chunkWikiPages(input);
  if (chunks.length === 0) {
    return [];
  }

  const model = input.model ?? 'text-embedding-3-small';
  const apiKey = input.openaiApiKey ?? process.env['OPENAI_API_KEY'];
  const client =
    options?.client ??
    (apiKey
      ? createEmbeddingClient(apiKey)
      : (() => {
          throw new Error('OPENAI_API_KEY is required to generate wiki embeddings.');
        })());

  const batchSize = clampBatchSize(input.batchSize);
  const embeddedChunks: IEmbeddedWikiSection[] = [];

  for (let index = 0; index < chunks.length; index += batchSize) {
    const batch = chunks.slice(index, index + batchSize);
    const response = await client.embeddings.create({
      model,
      input: batch.map((chunk) => chunk.chunkText),
    });

    if (response.data.length !== batch.length) {
      throw new Error(
        `Embedding API response mismatch: expected ${batch.length} vectors, received ${response.data.length}.`,
      );
    }

    batch.forEach((chunk, batchIndex) => {
      const embedding = response.data[batchIndex]?.embedding;
      if (!embedding) {
        throw new Error(`Missing embedding vector for chunk index ${chunk.chunkIndex}.`);
      }

      embeddedChunks.push({
        ...chunk,
        embedding,
      });
    });
  }

  return embeddedChunks;
};
