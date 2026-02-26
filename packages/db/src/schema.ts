import {
  pgTable,
  text,
  timestamp,
  type AnyPgColumn,
  boolean,
  integer,
  jsonb,
  uuid,
  varchar,
  date,
  index,
  uniqueIndex,
  customType,
} from 'drizzle-orm/pg-core';

const vector = customType<{ data: number[]; driverData: string; config: { dimensions: number } }>({
  dataType: (config) => `vector(${config?.dimensions ?? 1536})`,
  toDriver: (value) => `[${value.join(',')}]`,
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  workosId: text('workos_id').notNull().unique(),
  email: text('email').notNull(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  githubTokenEncrypted: text('github_token_encrypted'),
  githubTokenIv: text('github_token_iv'),
  githubTokenTag: text('github_token_tag'),
  githubRefreshTokenEncrypted: text('github_refresh_token_encrypted'),
  githubRefreshTokenIv: text('github_refresh_token_iv'),
  githubRefreshTokenTag: text('github_refresh_token_tag'),
  githubTokenExpiresAt: timestamp('github_token_expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const repositories = pgTable(
  'repositories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    owner: text('owner').notNull(),
    name: text('name').notNull(),
    fullName: text('full_name').notNull(),
    description: text('description'),
    isPrivate: boolean('is_private').default(false).notNull(),
    defaultBranch: text('default_branch').default('main').notNull(),
    trackedBranch: text('tracked_branch'),
    autoUpdate: boolean('auto_update').default(false).notNull(),
    webhookId: text('webhook_id'),
    webhookSecret: text('webhook_secret'),
    language: text('language'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userRepositoryUnique: uniqueIndex('repositories_user_full_name_unique').on(
      table.userId,
      table.fullName,
    ),
  }),
);

export const wikiVersions = pgTable(
  'wiki_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    repositoryId: uuid('repository_id')
      .references(() => repositories.id, { onDelete: 'cascade' })
      .notNull(),
    commitSha: varchar('commit_sha', { length: 40 }).notNull(),
    branch: text('branch').notNull(),
    status: text('status', { enum: ['pending', 'generating', 'ready', 'failed'] })
      .default('pending')
      .notNull(),
    errorMessage: text('error_message'),
    featureTree: jsonb('feature_tree').$type<Record<string, unknown> | null>(),
    analysis: jsonb('analysis').$type<Record<string, unknown> | null>(),
    featureCount: integer('feature_count').default(0).notNull(),
    pageCount: integer('page_count').default(0).notNull(),
    generatedAt: timestamp('generated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    repositoryCommitUnique: uniqueIndex('wiki_versions_repository_commit_unique').on(
      table.repositoryId,
      table.commitSha,
    ),
    repositoryStatusGeneratedAtIndex: index('wiki_versions_repository_status_generated_at_idx').on(
      table.repositoryId,
      table.status,
      table.generatedAt,
    ),
  }),
);

export const wikiShares = pgTable(
  'wiki_shares',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    repositoryId: uuid('repository_id')
      .references(() => repositories.id, { onDelete: 'cascade' })
      .notNull(),
    isPublic: boolean('is_public').default(false).notNull(),
    shareToken: uuid('share_token').defaultRandom().notNull(),
    embedEnabled: boolean('embed_enabled').default(false).notNull(),
    tokenRotatedAt: timestamp('token_rotated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    repositoryUnique: uniqueIndex('wiki_shares_repository_unique').on(table.repositoryId),
    shareTokenUnique: uniqueIndex('wiki_shares_share_token_unique').on(table.shareToken),
  }),
);

export const wikiPages = pgTable('wiki_pages', {
  id: uuid('id').primaryKey().defaultRandom(),
  wikiVersionId: uuid('wiki_version_id')
    .references(() => wikiVersions.id, { onDelete: 'cascade' })
    .notNull(),
  featureId: text('feature_id').notNull(),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  citations: jsonb('citations')
    .$type<
      Array<{
        text: string;
        filePath: string;
        startLine: number;
        endLine: number;
        url: string;
      }>
    >()
    .default([])
    .notNull(),
  parentPageId: uuid('parent_page_id').references((): AnyPgColumn => wikiPages.id, {
    onDelete: 'set null',
  }),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const wikiEmbeddings = pgTable(
  'wiki_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    repositoryId: uuid('repository_id')
      .references(() => repositories.id, { onDelete: 'cascade' })
      .notNull(),
    wikiVersionId: uuid('wiki_version_id')
      .references(() => wikiVersions.id, { onDelete: 'cascade' })
      .notNull(),
    wikiPageId: uuid('wiki_page_id')
      .references(() => wikiPages.id, { onDelete: 'cascade' })
      .notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    sectionHeading: text('section_heading').notNull(),
    chunkText: text('chunk_text').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }).notNull(),
    metadata: jsonb('metadata')
      .$type<{
        page_id: string;
        section_heading: string;
        repo_id: string;
        wiki_version_id: string;
        chunk_text: string;
      }>()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    wikiVersionIndex: index('wiki_embeddings_wiki_version_idx').on(table.wikiVersionId),
    wikiPageIndex: index('wiki_embeddings_wiki_page_idx').on(table.wikiPageId),
    embeddingHnswIndex: index('wiki_embeddings_embedding_hnsw_idx').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops'),
    ),
  }),
);

export const generationJobs = pgTable('generation_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  wikiVersionId: uuid('wiki_version_id')
    .references(() => wikiVersions.id, { onDelete: 'cascade' })
    .notNull(),
  status: text('status', { enum: ['queued', 'running', 'completed', 'failed'] })
    .default('queued')
    .notNull(),
  currentStep: text('current_step'),
  progress: integer('progress').default(0).notNull(),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const generationRateLimits = pgTable(
  'generation_rate_limits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    bucketDate: date('bucket_date').notNull(),
    count: integer('count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userBucketUnique: uniqueIndex('generation_rate_limits_user_bucket_unique').on(
      table.userId,
      table.bucketDate,
    ),
  }),
);

export const publicRequestRateLimits = pgTable(
  'public_request_rate_limits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestKey: text('request_key').notNull(),
    route: text('route').notNull(),
    bucketStart: timestamp('bucket_start', { withTimezone: true }).notNull(),
    count: integer('count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    requestRouteBucketUnique: uniqueIndex(
      'public_request_rate_limits_request_route_bucket_unique',
    ).on(table.requestKey, table.route, table.bucketStart),
  }),
);
