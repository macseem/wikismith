import { eq, sql, type SQL } from 'drizzle-orm';
import { db } from './client';
import { wikiEmbeddings } from './schema';

export interface IWikiEmbeddingRecord {
  wikiPageId: string;
  chunkIndex: number;
  sectionHeading: string;
  chunkText: string;
  embedding: number[];
  metadata: {
    page_id: string;
    section_heading: string;
    repo_id: string;
    wiki_version_id: string;
    chunk_text: string;
  };
}

export interface IReplaceWikiEmbeddingsInput {
  repositoryId: string;
  wikiVersionId: string;
  chunks: IWikiEmbeddingRecord[];
}

export interface IFindSimilarWikiEmbeddingsInput {
  wikiVersionId: string;
  queryEmbedding: number[];
  limit?: number;
}

export interface ISimilarWikiEmbedding {
  id: string;
  wikiPageId: string;
  sectionHeading: string;
  chunkText: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

const validateEmbedding = (embedding: number[]): void => {
  if (embedding.length === 0) {
    throw new Error('Embedding vector cannot be empty.');
  }

  const hasInvalidValue = embedding.some((value) => !Number.isFinite(value));
  if (hasInvalidValue) {
    throw new Error('Embedding vector must contain only finite numeric values.');
  }
};

const MAX_SIMILARITY_LIMIT = 100;

const toMetadataRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const toVectorLiteral = (embedding: number[]): string => {
  validateEmbedding(embedding);

  return `[${embedding.join(',')}]`;
};

const toVectorSql = (embedding: number[]): SQL => sql`${toVectorLiteral(embedding)}::vector`;

export const replaceWikiEmbeddings = async (input: IReplaceWikiEmbeddingsInput): Promise<void> => {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${input.repositoryId})::int, hashtext(${input.wikiVersionId})::int)`,
    );

    await tx.delete(wikiEmbeddings).where(eq(wikiEmbeddings.wikiVersionId, input.wikiVersionId));

    if (input.chunks.length === 0) {
      return;
    }

    await tx.insert(wikiEmbeddings).values(
      input.chunks.map((chunk) => {
        validateEmbedding(chunk.embedding);

        return {
          repositoryId: input.repositoryId,
          wikiVersionId: input.wikiVersionId,
          wikiPageId: chunk.wikiPageId,
          chunkIndex: chunk.chunkIndex,
          sectionHeading: chunk.sectionHeading,
          chunkText: chunk.chunkText,
          embedding: chunk.embedding,
          metadata: chunk.metadata,
        };
      }),
    );
  });
};

export const findSimilarWikiEmbeddings = async (
  input: IFindSimilarWikiEmbeddingsInput,
): Promise<ISimilarWikiEmbedding[]> => {
  const queryVector = toVectorSql(input.queryEmbedding);
  const limit = Math.min(MAX_SIMILARITY_LIMIT, Math.max(1, input.limit ?? 10));

  const result = await db.execute(sql`
    SELECT
      id,
      wiki_page_id AS "wikiPageId",
      section_heading AS "sectionHeading",
      chunk_text AS "chunkText",
      metadata,
      -- pgvector <=> returns cosine distance, so we convert to similarity with (1 - distance).
      1 - (embedding <=> ${queryVector}) AS similarity
    FROM wiki_embeddings
    WHERE wiki_version_id = ${input.wikiVersionId}
    ORDER BY embedding <=> ${queryVector}
    LIMIT ${limit}
  `);

  return result.rows.map((row) => {
    const id = row['id'];
    const wikiPageId = row['wikiPageId'];
    const sectionHeading = row['sectionHeading'];
    const chunkText = row['chunkText'];
    const metadata = row['metadata'];
    const similarity = row['similarity'];

    if (
      typeof id !== 'string' ||
      typeof wikiPageId !== 'string' ||
      typeof sectionHeading !== 'string' ||
      typeof chunkText !== 'string'
    ) {
      throw new Error('Unexpected similarity row payload from wiki embeddings query.');
    }

    return {
      id,
      wikiPageId,
      sectionHeading,
      chunkText,
      metadata: toMetadataRecord(metadata),
      similarity:
        typeof similarity === 'number'
          ? similarity
          : Number.isFinite(Number(similarity))
            ? Number(similarity)
            : 0,
    };
  });
};
