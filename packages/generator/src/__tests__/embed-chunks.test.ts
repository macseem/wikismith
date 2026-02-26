import { encode } from 'gpt-tokenizer';
import { describe, expect, it, vi } from 'vitest';
import { chunkWikiPages, embedChunks } from '../embed-chunks';

const makeTokens = (prefix: string, count: number): string =>
  Array.from({ length: count }, (_, index) => `${prefix}-${index + 1}`).join(' ');

describe('chunkWikiPages', () => {
  it('chunks markdown into 500-1000 token windows with overlap', () => {
    const page = {
      pageId: 'page-1',
      title: 'Architecture',
      content: [
        '## Overview',
        makeTokens('overview', 700),
        '',
        '### Data flow',
        makeTokens('data', 700),
      ].join('\n'),
    };

    const chunks = chunkWikiPages({
      pages: [page],
      minTokens: 500,
      maxTokens: 1000,
      overlapTokens: 100,
    });

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => {
      expect(chunk.tokenCount).toBeLessThanOrEqual(1000);
      expect(chunk.pageId).toBe('page-1');
    });

    const firstChunkTokens = encode(chunks[0]!.chunkText);
    const secondChunkTokens = encode(chunks[1]!.chunkText);
    const firstChunkOverlap = firstChunkTokens.slice(-100);
    const secondChunkOverlap = secondChunkTokens.slice(0, 100);

    expect(secondChunkOverlap).toEqual(firstChunkOverlap);
  });
});

describe('embedChunks', () => {
  it('embeds in batches and preserves chunk metadata', async () => {
    const page = {
      pageId: 'page-1',
      title: 'Authentication',
      content: ['## Intro', makeTokens('intro', 30)].join('\n'),
    };
    const chunkingConfig = {
      pages: [page],
      minTokens: 4,
      maxTokens: 8,
      overlapTokens: 2,
      batchSize: 2,
    };
    const expectedChunkCount = chunkWikiPages(chunkingConfig).length;
    const expectedBatchCalls = Math.ceil(expectedChunkCount / 2);

    const create = vi.fn(async ({ input }: { model: string; input: string[] }) => ({
      data: input.map((_, index) => ({ embedding: [index + 1, 0.5, 0.25] })),
    }));

    const embedded = await embedChunks(chunkingConfig, {
      client: {
        embeddings: {
          create,
        },
      },
    });

    expect(embedded.length).toBe(expectedChunkCount);
    expect(create).toHaveBeenCalledTimes(expectedBatchCalls);
    expect(embedded[0]?.embedding).toEqual([1, 0.5, 0.25]);
    expect(embedded[0]?.pageId).toBe('page-1');
    expect(embedded[0]?.tokenCount).toBeLessThanOrEqual(8);
  });

  it('throws when no client or API key is provided', async () => {
    const originalApiKey = process.env['OPENAI_API_KEY'];
    delete process.env['OPENAI_API_KEY'];

    await expect(
      embedChunks({
        pages: [{ pageId: 'page-1', title: 'Overview', content: '## Summary\nHello world' }],
      }),
    ).rejects.toThrow('OPENAI_API_KEY is required');

    if (originalApiKey) {
      process.env['OPENAI_API_KEY'] = originalApiKey;
    }
  });
});
