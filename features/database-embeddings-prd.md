# Database Schema & Embeddings Pipeline — PRD

## 1. Goal

Establish a robust, type-safe data layer for WikiSmith using Neon PostgreSQL with pgvector—enabling persistent storage of users, repositories, wiki versions, pages, and embeddings; supporting the RAG pipeline for semantic search and AI Q&A; and providing a migration-driven schema evolution workflow via Drizzle ORM.

## 2. Problem Statement

WikiSmith needs a durable, queryable data layer to:

- **Persist user and repository data** — WorkOS users, encrypted GitHub tokens, repo metadata, webhook configuration, and generation status
- **Store wiki content** — Generated markdown pages tied to specific commits, with feature classification and parent-child hierarchy
- **Power semantic search and Q&A** — Embed wiki content for RAG: embed questions, retrieve similar chunks, feed context to GPT
- **Track async generation** — Long-running wiki generation jobs need status tracking (pending, running, completed, failed)

Without a well-designed schema and embeddings pipeline:

- User tokens and repo config cannot be persisted securely
- Wiki content would be ephemeral (e.g., in-memory or `/tmp`)
- Q&A and semantic search would require full-wiki context (fails for large repos)
- No visibility into generation progress or failure reasons

The data layer must be serverless-friendly (Neon, Vercel), type-safe (Drizzle), and support vector similarity search (pgvector) for RAG at scale.

## 3. User Stories

- As a **user**, I want my GitHub token stored securely and associated with my account, so that WikiSmith can access my private repos.
- As a **repository maintainer**, I want my repo's wiki versions tied to specific commits, so that I can view documentation for any historical state.
- As a **developer exploring a wiki**, I want to search semantically (e.g., "authentication flow") and find relevant sections, so that I don't have to browse manually.
- As a **developer**, I want to ask natural language questions and get answers grounded in the wiki, so that I can understand the codebase quickly.
- As a **WikiSmith developer**, I want type-safe database access and migrations, so that schema changes are versioned and reproducible.
- As a **WikiSmith developer**, I want embeddings computed and stored when a wiki is generated, so that Q&A and search are fast on first use.
- As a **user submitting a repo URL**, I want to see generation status (pending, running, completed, failed), so that I know when the wiki is ready.

## 4. Functional Requirements (with FR-xxx IDs)

### 4.1 Users Table

- **FR-001**: The schema MUST include a `users` table storing: `id` (PK), `workos_id` (unique), `email`, `name`, `avatar_url`, `created_at`, `updated_at`.
- **FR-002**: The schema MUST support encrypted storage of GitHub access tokens (e.g., `github_token_encrypted` column); tokens MUST NOT be stored in plaintext.
- **FR-003**: The `users` table MUST enforce uniqueness on `workos_id` (one WorkOS user → one WikiSmith user).
- **FR-004**: The schema MUST support optional fields for OAuth refresh tokens and token expiry if GitHub token refresh is implemented.

### 4.2 Repositories Table

- **FR-005**: The schema MUST include a `repositories` table storing: `id` (PK), `owner`, `name`, `default_branch`, `tracked_branch` (branch used for wiki generation), `user_id` (FK), `webhook_id` (optional), `webhook_secret_encrypted` (optional), `status` (e.g., `active`, `archived`, `error`), `last_synced_at`, `created_at`, `updated_at`.
- **FR-006**: The schema MUST enforce uniqueness on `(owner, name)` per user (or globally, depending on multi-tenant model).
- **FR-007**: The `repositories` table MUST support a `status` enum or string: `pending`, `syncing`, `ready`, `error`, `archived`.
- **FR-008**: The schema MUST support webhook configuration: `webhook_id` (GitHub webhook ID), `webhook_secret_encrypted` for signature verification.

### 4.3 Wiki Versions Table

- **FR-009**: The schema MUST include a `wiki_versions` table storing: `id` (PK), `repository_id` (FK), `commit_sha`, `generation_status` (e.g., `pending`, `running`, `completed`, `failed`), `error_message` (nullable), `page_count`, `generated_at` (nullable), `created_at`, `updated_at`.
- **FR-010**: Each wiki version MUST be uniquely identified by `(repository_id, commit_sha)`.
- **FR-011**: The `generation_status` MUST support: `pending`, `running`, `completed`, `failed`.
- **FR-012**: The schema MUST support metadata: `page_count`, `generated_at` (timestamp when generation completed).

### 4.4 Wiki Pages Table

- **FR-013**: The schema MUST include a `wiki_pages` table storing: `id` (PK), `wiki_version_id` (FK), `feature_id` (from classification), `slug`, `title`, `content` (markdown), `parent_page_id` (nullable FK for hierarchy), `sort_order`, `created_at`, `updated_at`.
- **FR-014**: Wiki pages MUST be tied to a `wiki_version_id`; deleting a version cascades to its pages.
- **FR-015**: The schema MUST support parent-child hierarchy via `parent_page_id` (self-referential FK).
- **FR-016**: The schema MUST support `slug` uniqueness per wiki version (e.g., unique `(wiki_version_id, slug)`).
- **FR-017**: The `content` column MUST store markdown; consider `text` or `varchar` with sufficient length (e.g., 1MB for large pages).

### 4.5 Embeddings Table (pgvector)

- **FR-018**: The schema MUST include an `embeddings` table with: `id` (PK), `wiki_page_id` (FK), `chunk_index`, `content` (chunk text), `embedding` (vector type), `metadata` (JSONB for section, heading, repo_id), `created_at`.
- **FR-019**: The `embedding` column MUST use pgvector's `vector` type with dimension matching OpenAI `text-embedding-3-small` (1536 dimensions).
- **FR-020**: The schema MUST support an index on `embedding` for efficient similarity search (e.g., IVFFlat or HNSW with cosine distance).
- **FR-021**: Embeddings MUST be scoped to a wiki page; `wiki_page_id` FK enables cascade delete when a page is removed.
- **FR-022**: The `metadata` JSONB MUST include: `page_id`, `section`, `repo_id`, `wiki_version_id` (or equivalent) for retrieval context and filtering.

### 4.6 Generation Jobs Table

- **FR-023**: The schema MUST include a `generation_jobs` table storing: `id` (PK), `repository_id` (FK), `wiki_version_id` (FK, nullable until created), `status` (e.g., `queued`, `running`, `completed`, `failed`), `triggered_by` (user_id), `started_at`, `completed_at`, `error_message`, `created_at`, `updated_at`.
- **FR-024**: Generation jobs MUST track status: `queued`, `running`, `completed`, `failed`.
- **FR-025**: The schema MUST support linking a job to its resulting `wiki_version_id` when generation completes.
- **FR-026**: The schema MUST support `error_message` for failed jobs; `started_at` and `completed_at` for timing.

### 4.7 Embeddings Pipeline — Chunking

- **FR-027**: When a wiki is generated, the system MUST chunk each page into sections (by `##` or `###` headers); each chunk = one embeddable unit.
- **FR-028**: Chunk size MUST be configurable; default 500–1000 tokens per chunk with 100-token overlap at boundaries.
- **FR-029**: Chunks MUST preserve context: include section headers in chunk content; overlap prevents context loss at boundaries.
- **FR-030**: The system MUST NOT chunk pages that are smaller than the chunk size; small pages = single chunk.

### 4.8 Embeddings Pipeline — Generation & Storage

- **FR-031**: The system MUST generate embeddings using OpenAI `text-embedding-3-small` (or equivalent; configurable).
- **FR-032**: Embeddings MUST be stored in pgvector with metadata (page ID, section, repo ID, wiki version ID).
- **FR-033**: When a wiki is regenerated, the system MUST delete old embeddings for that wiki version and insert new ones (no orphaned embeddings).
- **FR-034**: Embedding generation MUST be idempotent for a given wiki version: re-running produces the same set of embeddings (deterministic chunking).

### 4.9 Embeddings Pipeline — RAG for Q&A

- **FR-035**: For Q&A: embed the user's question, find top-k similar chunks via cosine similarity, pass chunks to GPT as context.
- **FR-036**: The retrieval MUST use cosine distance (`<=>` in pgvector); return chunks ordered by similarity (ascending distance).
- **FR-037**: Top-k MUST be configurable (default 5–10 chunks); retrieved chunks MUST include metadata for citation (page, section, repo).
- **FR-038**: The system MUST filter embeddings by `wiki_version_id` (or equivalent) so Q&A is scoped to the correct wiki version.

### 4.10 Embeddings Pipeline — Semantic Search

- **FR-039**: For semantic search: embed the user's query, find similar chunks via cosine similarity, return matching wiki sections with metadata.
- **FR-040**: Search results MUST include: page title, section, snippet, and link to full page.
- **FR-041**: Search MUST be scoped to a wiki version (or repository); no cross-wiki search for MVP.

### 4.11 ORM & Migrations

- **FR-042**: The schema MUST be defined using Drizzle ORM (TypeScript schema declaration).
- **FR-043**: Migrations MUST be generated via Drizzle Kit (`drizzle-kit generate`) and applied via `drizzle-kit migrate` (or equivalent).
- **FR-044**: All database access MUST use Drizzle's type-safe query API; no raw SQL for CRUD unless necessary (e.g., custom vector queries).
- **FR-045**: Database connection MUST use Neon's serverless driver (`@neondatabase/serverless`) for connection pooling in serverless (Vercel).

## 5. Non-Functional Requirements (with NFR-xxx IDs)

- **NFR-001**: Database connection MUST be suitable for serverless (Vercel): use HTTP/WebSocket via `@neondatabase/serverless`; avoid long-lived TCP connections.
- **NFR-002**: Connection pooling MUST be configured via Neon's pooled connection string (e.g., `-pooler` suffix) or the serverless driver's built-in pooling.
- **NFR-003**: Encrypted columns (GitHub tokens, webhook secrets) MUST use encryption at rest; key management via env vars (e.g., `ENCRYPTION_KEY`).
- **NFR-004**: Embedding generation for a typical wiki (50 pages, ~100 chunks) MUST complete within 2 minutes p95.
- **NFR-005**: Similarity search (top-10) for a single query MUST complete within 200ms p95 for wikis with up to 5000 chunks.
- **NFR-006**: The schema MUST support indexes for efficient lookups: `users.workos_id`, `repositories(owner, name)`, `wiki_versions(repository_id, commit_sha)`, `wiki_pages(wiki_version_id)`, `embeddings(wiki_page_id)`.
- **NFR-007**: Migrations MUST be reversible where possible (e.g., down migrations); document irreversible migrations.
- **NFR-008**: The embeddings pipeline MUST NOT block wiki generation; it MAY run asynchronously after pages are committed (e.g., background job or post-generation step).

## 6. UI/UX Requirements

- **UI-001**: The database and embeddings pipeline are backend components; they have no direct user-facing UI.
- **UI-002**: Generation status (from `generation_jobs` and `wiki_versions`) MUST be surfaced in the UI (e.g., "Generating…", "Completed", "Failed: [reason]").
- **UI-003**: Semantic search results (from embeddings) MUST be displayed in the wiki UI (search bar, results list with page/section/snippet).
- **UI-004**: Q&A answers (from RAG) MUST display citations linking to source pages/sections; metadata from embeddings enables accurate linking.
- **UI-005**: Error states (e.g., "Embeddings not yet ready") MUST be communicated when search or Q&A is used before embeddings are computed.

## 7. Technical Considerations

### 7.1 Schema Overview (Drizzle)

```typescript
// Example structure (simplified); exact schema in packages/db or apps/web
import { pgTable, uuid, varchar, text, timestamp, jsonb, integer, vector, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  workosId: varchar('workos_id', { length: 255 }).unique().notNull(),
  email: varchar('email', { length: 255 }),
  name: varchar('name', { length: 255 }),
  avatarUrl: varchar('avatar_url', { length: 512 }),
  githubTokenEncrypted: text('github_token_encrypted'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const repositories = pgTable('repositories', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  owner: varchar('owner', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  defaultBranch: varchar('default_branch', { length: 255 }),
  trackedBranch: varchar('tracked_branch', { length: 255 }),
  webhookId: varchar('webhook_id', { length: 255 }),
  webhookSecretEncrypted: text('webhook_secret_encrypted'),
  status: varchar('status', { length: 50 }).default('pending'),
  lastSyncedAt: timestamp('last_synced_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const wikiVersions = pgTable('wiki_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  repositoryId: uuid('repository_id').references(() => repositories.id).notNull(),
  commitSha: varchar('commit_sha', { length: 40 }).notNull(),
  generationStatus: varchar('generation_status', { length: 50 }).default('pending'),
  errorMessage: text('error_message'),
  pageCount: integer('page_count'),
  generatedAt: timestamp('generated_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const wikiPages = pgTable('wiki_pages', {
  id: uuid('id').primaryKey().defaultRandom(),
  wikiVersionId: uuid('wiki_version_id').references(() => wikiVersions.id).notNull(),
  featureId: varchar('feature_id', { length: 255 }),
  slug: varchar('slug', { length: 512 }).notNull(),
  title: varchar('title', { length: 512 }).notNull(),
  content: text('content'),
  parentPageId: uuid('parent_page_id').references(() => wikiPages.id),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// pgvector: vector(1536) for text-embedding-3-small
export const embeddings = pgTable(
  'embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    wikiPageId: uuid('wiki_page_id').references(() => wikiPages.id).notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('embeddings_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
  ]
);

export const generationJobs = pgTable('generation_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  repositoryId: uuid('repository_id').references(() => repositories.id).notNull(),
  wikiVersionId: uuid('wiki_version_id').references(() => wikiVersions.id),
  status: varchar('status', { length: 50 }).default('queued'),
  triggeredBy: uuid('triggered_by').references(() => users.id),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

### 7.2 pgvector Setup

- **Extension**: Enable `CREATE EXTENSION vector` in Neon (supported in Neon PostgreSQL).
- **Vector dimension**: 1536 for `text-embedding-3-small`; 3072 for `text-embedding-3-large` if upgraded.
- **Index**: Use IVFFlat for cosine: `CREATE INDEX ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);` — adjust `lists` based on row count (rule of thumb: sqrt(n) to n/1000).
- **Alternative**: HNSW index for higher recall: `CREATE INDEX ON embeddings USING hnsw (embedding vector_cosine_ops);` — better for large datasets, slightly more storage.

### 7.3 Similarity Search Query (Cosine)

```sql
-- Top-k similar chunks by cosine distance
SELECT e.id, e.content, e.metadata, 1 - (e.embedding <=> $1::vector) AS similarity
FROM embeddings e
JOIN wiki_pages wp ON e.wiki_page_id = wp.id
JOIN wiki_versions wv ON wp.wiki_version_id = wv.id
WHERE wv.id = $2
ORDER BY e.embedding <=> $1::vector
LIMIT 10;
```

### 7.4 Chunking Strategy

- **Split by headers**: Use `##` and `###` as primary boundaries; each section becomes a chunk.
- **Token limit**: If a section exceeds ~1000 tokens, split by paragraph or sentence boundary.
- **Overlap**: Include last 100 tokens of previous chunk at start of next chunk (sliding window).
- **Metadata**: Store `section`, `heading`, `page_id`, `repo_id`, `wiki_version_id` in JSONB for retrieval context.

### 7.5 Encryption for Sensitive Columns

- **Algorithm**: AES-256-GCM or similar; use `ENCRYPTION_KEY` env var (32 bytes for AES-256).
- **Storage**: Store IV + ciphertext; decrypt on read.
- **Scope**: `github_token_encrypted`, `webhook_secret_encrypted`; never log decrypted values.

### 7.6 Drizzle Kit Configuration

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});
```

### 7.7 Neon Serverless Driver

```typescript
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql);
```

- Use HTTP for single queries (faster cold start); WebSockets for transactions if needed.
- Connection string: use `-pooler` endpoint for pooled connections.

### 7.8 Package Boundaries

- **Schema & migrations**: `packages/db` or `apps/web/src/db` — Drizzle schema, migrations, db client.
- **Embeddings pipeline**: `packages/embeddings` or `packages/generator` — chunking, OpenAI embedding API, insert into pgvector.
- **RAG retrieval**: `packages/qa` or shared — embed question, query pgvector, return chunks.
- **Dependencies**: `packages/db` depends on `drizzle-orm`, `@neondatabase/serverless`, `pgvector`; no dependency on `packages/analyzer` or `packages/generator` for schema only.

## 8. Dependencies

- **Neon PostgreSQL**: Provisioned account; schema supports pgvector extension.
- **Drizzle ORM**: `drizzle-orm`, `drizzle-kit` for schema and migrations.
- **Neon serverless driver**: `@neondatabase/serverless` for connection pooling.
- **pgvector**: Extension enabled in Neon; `pgvector` npm package for Drizzle vector column type (if available) or raw SQL for vector ops.
- **OpenAI API**: `text-embedding-3-small` for embeddings; `OPENAI_API_KEY` required.
- **WorkOS**: User identity; `workos_id` links to WorkOS user.
- **Wiki content generation**: Embeddings pipeline REQUIRES generated wiki pages (from `packages/generator`).
- **Repository ingestion**: Repo metadata (owner, name, branch) from ingestion stage.

## 9. Success Metrics

- **SM-1**: Schema migrations apply cleanly in < 30 seconds; zero failed migrations in CI.
- **SM-2**: All CRUD operations complete via type-safe Drizzle queries; no runtime type errors from DB layer.
- **SM-3**: Embedding generation for 50-page wiki completes in < 2 minutes p95.
- **SM-4**: Similarity search (top-10) completes in < 200ms p95 for 5000 chunks.
- **SM-5**: RAG retrieval returns relevant chunks for 80%+ of curated test questions (manual evaluation).
- **SM-6**: Zero plaintext storage of GitHub tokens or webhook secrets; encryption verified.
- **SM-7**: Re-embedding on wiki regeneration: old embeddings deleted, new ones inserted; no orphaned rows.
- **SM-8**: Generation job status accurately reflects pipeline state (queued → running → completed/failed).

## 10. Out of Scope

- **Multi-region replication**: Neon supports branching; single region for MVP.
- **Full-text search (PostgreSQL)**: Semantic search is primary; pg vector only; FTS may be added later for hybrid search.
- **Embedding model fine-tuning**: Use OpenAI embeddings as-is; no custom models.
- **Incremental embedding**: Only full re-embed on wiki regeneration; no incremental updates for changed pages.
- **Cross-wiki search**: Search limited to single wiki version; no aggregation across repos.
- **Embedding caching**: No separate cache layer; pgvector is source of truth.
- **Alternative vector DBs**: Pinecone, Weaviate, etc. out of scope; pgvector only.
- **Re-ranking**: Single-pass retrieval; no cross-encoder or second-pass re-ranking for MVP.
- **Audit logging**: No schema for audit trail of user actions; future enhancement.

## 11. Open Questions

- **OQ-1**: Should `repositories` be globally unique on `(owner, name)` or per-user? Multi-tenant: same repo can be added by different users?
- **OQ-2**: Where to run embedding generation: same process as wiki generation (blocking) vs. async job (Inngest, Trigger.dev)? Affects latency and architecture.
- **OQ-3**: IVFFlat vs. HNSW index: IVFFlat requires `lists` tuning; HNSW has no training step. Benchmark and choose.
- **OQ-4**: Chunk overlap: 100 tokens sufficient? Some RAG systems use 50–200; need empirical validation.
- **OQ-5**: Should we store raw chunk text in `embeddings.content` or only in `wiki_pages.content`? Redundant but enables retrieval without join; trade-off: storage vs. query simplicity.
- **OQ-6**: Encryption key rotation: how to handle when `ENCRYPTION_KEY` changes? Re-encrypt all tokens? Document strategy.
- **OQ-7**: Drizzle + pgvector: does Drizzle have native vector column support, or do we need raw SQL for vector ops? Check `pgvector` npm package compatibility.
- **OQ-8**: Connection string: use Neon's pooled or direct endpoint? Pooled recommended for serverless.

## 12. Milestones

### M1: Schema & ORM Foundation (MVP)

- FR-001, FR-002, FR-003, FR-004 (users table)
- FR-005, FR-006, FR-007, FR-008 (repositories table)
- FR-009, FR-010, FR-011, FR-012 (wiki_versions table)
- FR-013, FR-014, FR-015, FR-016, FR-017 (wiki_pages table)
- FR-023, FR-024, FR-025, FR-026 (generation_jobs table)
- FR-042, FR-043, FR-044, FR-045 (Drizzle ORM, migrations, Neon driver)
- NFR-001, NFR-002, NFR-006, NFR-007

**Deliverable**: Drizzle schema defined; migrations applied to Neon; type-safe CRUD for users, repos, wiki versions, pages, jobs.

### M2: pgvector & Embeddings Table

- FR-018, FR-019, FR-020, FR-021, FR-022 (embeddings table)
- Enable pgvector extension; create embeddings table; IVFFlat index
- NFR-005 (similarity search performance)

**Deliverable**: Embeddings table with vector column; index; schema supports insert and similarity query.

### M3: Embeddings Pipeline — Chunking & Storage

- FR-027, FR-028, FR-029, FR-030 (chunking)
- FR-031, FR-032, FR-033, FR-034 (generation & storage)
- NFR-004, NFR-008 (performance, async)

**Deliverable**: Chunk wiki pages; call OpenAI embeddings API; insert into pgvector; delete old embeddings on wiki regeneration.

### M4: RAG Integration — Q&A & Search

- FR-035, FR-036, FR-037, FR-038 (RAG for Q&A)
- FR-039, FR-040, FR-041 (semantic search)
- Integration with `packages/qa` and wiki UI

**Deliverable**: Q&A and semantic search use pgvector retrieval; top-k chunks passed to GPT; search results displayed in UI.

### M5: Encryption & Hardening

- NFR-003 (encryption for tokens, webhook secrets)
- Key management; encryption/decryption utilities
- Error handling, logging

**Deliverable**: GitHub tokens and webhook secrets encrypted at rest; production-ready data layer.
