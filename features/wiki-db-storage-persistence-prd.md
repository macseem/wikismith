# Wiki DB Storage Persistence — PRD

## Goal

Replace file-based wiki persistence (`.wikismith-cache`) with database-backed storage in Neon/Postgres so generated wikis are durable, multi-instance safe, and ready for downstream features (versioning, embeddings, Q&A).

## Problem Statement

WikiSmith currently stores generated wiki payloads as local JSON files via `apps/web/src/lib/wiki-store.ts`. This is a blocker for production reliability and for the roadmap:

- data is tied to a single runtime filesystem and can be lost on redeploys
- concurrent app instances do not share cache state
- authorization, query/filter, and version access are limited by file primitives
- embeddings/RAG cannot reliably depend on file-only wiki data

We already have Drizzle schema for `repositories`, `wiki_versions`, and `wiki_pages`, but generation/read routes still use file storage.

## User Stories

- As a signed-in user, I want generated wikis to persist across deployments and sessions.
- As a user with multiple repositories, I want reliable lookup of existing wikis without file cache drift.
- As a maintainer, I want ownership and access control enforced by DB records, not file metadata.
- As a platform engineer, I want one source of truth for wiki content so versioning, embeddings, and Q&A can build on stable data.

## Functional Requirements

- **FR-001**: Generation flow MUST write wiki metadata/pages to DB instead of `saveWiki` file writes.
- **FR-002**: Wiki read API (`/api/wiki/[owner]/[repo]`) MUST read latest ready wiki from DB.
- **FR-003**: Existence checks (`hasWiki`/cache checks in generation flow) MUST be replaced by DB lookups.
- **FR-004**: Delete wiki flow MUST delete DB-backed wiki data (versions/pages) and remain user-scoped.
- **FR-005**: For each generation, `wiki_versions` MUST store commit SHA + status lifecycle (`pending`/`generating`/`ready`/`failed`).
- **FR-006**: Generated pages MUST persist in `wiki_pages` with stable `slug`, `title`, `content`, and ordering.
- **FR-007**: Latest wiki resolution MUST be deterministic (most recent ready generation for repo + user scope).
- **FR-008**: File cache reads/writes MUST be removed from production paths; optional temporary migration fallback can exist behind an explicit flag.
- **FR-009**: Existing dashboard status logic MUST remain correct after storage migration.

## Non-Functional Requirements

- **NFR-001**: DB persistence path MUST be idempotent for repeated generation of same repo/commit.
- **NFR-002**: Read path for latest wiki MUST complete under 200ms p95 for typical wiki sizes.
- **NFR-003**: Migration must be safe for multi-instance deployment (no local fs dependency).
- **NFR-004**: No plaintext secrets/tokens stored in new fields.

## Technical Notes

- Replace usages of `apps/web/src/lib/wiki-store.ts` in:
  - `apps/web/src/app/api/generate/route.ts`
  - `apps/web/src/app/api/wiki/[owner]/[repo]/route.ts`
  - `apps/web/src/lib/repos/repository-service.ts` (cache deletion/status fallback)
- Introduce DB storage helpers (new module, e.g. `apps/web/src/lib/wiki-db-store.ts`) for:
  - upsert repo row by `(user_id, full_name)`
  - create `wiki_versions` row per generation
  - replace pages for a version
  - fetch latest ready wiki view model for API/page consumption
- Keep API response shape compatible with current wiki page client (`StoredWiki`-compatible DTO) during migration.
- Add indexes/constraints if missing for efficient latest-version lookup and page uniqueness.
- Plan a small data migration strategy:
  - optional one-time backfill from file cache for local/dev
  - no hard dependency on historical file backfill for production cutover

## Success Metrics

- 100% of new generations are written to DB (no file writes in normal path).
- `/api/wiki/[owner]/[repo]` returns DB-backed data for generated repositories.
- Production deployments no longer rely on `.wikismith-cache` persistence.
- Existing integration checks (build/lint/type-check/test) pass after migration.

## Out of Scope

- Embeddings generation and vector retrieval implementation details.
- Cross-repo/global semantic search UX.
- Historical backfill of every local file cache artifact in all environments.

## Open Questions

- Should we support reading legacy file cache as temporary fallback in non-prod only?
- Do we need an explicit `latest_ready_wiki_version_id` pointer on `repositories` for faster reads?
- Should status and error detail fields on `wiki_versions` be expanded now or in follow-up versioning task?
