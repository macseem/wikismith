import { pgTable, text, timestamp, boolean, integer, jsonb, uuid, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  workosId: text('workos_id').notNull().unique(),
  email: text('email').notNull(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  githubTokenEncrypted: text('github_token_encrypted'),
  githubTokenIv: text('github_token_iv'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const repositories = pgTable('repositories', {
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
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const wikiVersions = pgTable('wiki_versions', {
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
  featureCount: integer('feature_count').default(0).notNull(),
  pageCount: integer('page_count').default(0).notNull(),
  generatedAt: timestamp('generated_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const wikiPages = pgTable('wiki_pages', {
  id: uuid('id').primaryKey().defaultRandom(),
  wikiVersionId: uuid('wiki_version_id')
    .references(() => wikiVersions.id, { onDelete: 'cascade' })
    .notNull(),
  featureId: text('feature_id').notNull(),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  citations: jsonb('citations').$type<Array<{
    text: string;
    filePath: string;
    startLine: number;
    endLine: number;
    url: string;
  }>>().default([]).notNull(),
  parentPageId: uuid('parent_page_id'),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

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
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
