# Wiki Versioning & Auto-Update — PRD

## 1. Goal

Enable WikiSmith wikis to be **commit-pinned** and **automatically updated** when the tracked branch changes—so that documentation stays in sync with the codebase, users always know which commit their wiki reflects, and they can optionally browse version history or roll back to a previous wiki state.

## 2. Problem Statement

Today, a generated wiki is a point-in-time snapshot. Without versioning and auto-update:

- **Stale documentation**: After a push to the repo, the wiki becomes outdated; users may read docs that no longer match the code.
- **No traceability**: Users cannot tell which commit or tag a wiki was generated from—critical when debugging or comparing behavior across versions.
- **Manual re-generation**: Users must remember to re-run wiki generation after every significant change; friction leads to abandoned wikis.
- **No rollback**: If a bad push produces a broken or low-quality wiki, there is no way to revert to a known-good version.
- **URL ambiguity**: Wiki URLs do not encode version context; sharing a link may point to different content over time.

WikiSmith must tie every wiki to a specific commit SHA, allow users to select a branch to track, automatically regenerate when that branch receives a push, and retain a bounded version history for comparison and recovery.

## 3. User Stories

- As a **developer reading a wiki**, I want to see which commit SHA and branch the wiki was generated from, so that I can verify I'm looking at docs for the right code version.
- As a **repository maintainer**, I want to select which branch to track (default: default branch), so that the wiki stays in sync with my main development line.
- As a **repository maintainer**, I want the wiki to automatically regenerate when I push to the tracked branch, so that I don't have to manually trigger updates.
- As a **developer**, I want wiki URLs to include or reference the commit (e.g., `/wiki/owner/repo/abc1234`), so that I can share links that point to a specific version.
- As a **developer**, I want to browse previous wiki versions when available, so that I can compare documentation across releases or recover from a bad update.
- As a **user**, I want to see "updating..." status when a push triggers regeneration, so that I know the wiki is being refreshed.
- As a **platform operator**, I want webhook payloads verified via GitHub signatures, so that malicious actors cannot trigger unauthorized regeneration.
- As a **developer**, I want the system to handle rapid successive pushes gracefully, so that I don't get inconsistent or duplicate wiki versions.
- As a **user**, I want clear feedback when a repo is deleted or I lose access, so that I understand why the wiki is unavailable or stale.

## 4. Functional Requirements (with FR-xxx IDs)

### 4.1 Commit-Pinned Wikis

- **FR-001**: Every generated wiki MUST be tied to a specific commit SHA; the SHA MUST be stored as the canonical version identifier.
- **FR-002**: Wiki metadata MUST include: `commitSha`, `branch` (or `ref`), `generatedAt` (ISO 8601 timestamp), and `status` (e.g., `ready`, `updating`, `failed`).
- **FR-003**: Users MUST be able to see which commit and branch a wiki was generated from—displayed prominently on the wiki home page and in wiki metadata.
- **FR-004**: Citation URLs in generated content MUST reference the commit SHA (or tracked branch) so that links to GitHub source remain valid for the version the wiki describes.
- **FR-005**: When a user requests a wiki for `owner/repo` without a ref, the system MUST serve the wiki for the **current HEAD of the tracked branch** (or default branch if no tracking is configured).

### 4.2 URL Structure

- **FR-006**: Wiki URLs MUST support commit-based access. Format options: `/wiki/[owner]/[repo]/[commitSha]` (e.g., `/wiki/vercel/next.js/abc1234`) or `/wiki/[owner]/[repo]?ref=[branch]` with implicit HEAD resolution.
- **FR-007**: The canonical "latest" wiki URL for a repo MUST be `/wiki/[owner]/[repo]` (or equivalent)—resolving to the current HEAD of the tracked branch.
- **FR-008**: URLs MUST support both: (a) explicit commit SHA for immutable version access, (b) branch/tag ref for "latest at this ref" semantics.
- **FR-009**: The system MUST redirect or resolve `/wiki/[owner]/[repo]?ref=main` to the wiki for the current HEAD of `main`; if that wiki is updating, show status accordingly.

### 4.3 Branch Tracking

- **FR-010**: Users MUST be able to select a branch to track for auto-updates; default MUST be the repository's default branch (from GitHub API).
- **FR-011**: The tracked branch MUST be persisted per wiki/repo configuration (e.g., in Neon Postgres); changing the tracked branch MUST be a user action (settings or onboarding).
- **FR-012**: The system MUST support tracking only one branch per repo; tracking multiple branches produces multiple wiki "instances" (future consideration) or is out of scope for MVP.
- **FR-013**: When the tracked branch is changed, the system MUST NOT automatically regenerate; the user MAY trigger a manual regeneration if desired.

### 4.4 Auto-Update on Push

- **FR-014**: When the tracked branch receives a new push (detected via webhook or polling), the system MUST trigger wiki regeneration for the new HEAD commit.
- **FR-015**: Regeneration MUST be asynchronous—a background job is enqueued; the user sees "updating..." status until completion.
- **FR-016**: While a wiki is "updating", the system MUST continue to serve the **previous** wiki version (if available) so users are not blocked.
- **FR-017**: On successful regeneration, the new wiki becomes the "current" version for the tracked branch; the previous version moves to history (subject to retention policy).
- **FR-018**: On regeneration failure, the system MUST retain the previous wiki as current and surface an error (e.g., "Update failed: [reason]—retry or contact support").

### 4.5 Push Detection (Webhooks vs. Polling)

- **FR-019**: The system MUST support at least one mechanism for detecting pushes: (a) GitHub Webhooks, (b) GitHub App webhooks, or (c) polling. **Recommendation for MVP: GitHub Webhooks.**
- **FR-020**: If using webhooks: the system MUST expose a publicly accessible HTTP endpoint (e.g., `POST /api/webhooks/github`) that accepts GitHub `push` events.
- **FR-021**: The webhook endpoint MUST verify the `X-Hub-Signature-256` header using the configured webhook secret; requests with invalid or missing signatures MUST be rejected with 401.
- **FR-022**: The webhook MUST filter for `push` events on the tracked branch only; events for other branches MUST be acknowledged but ignored (return 200, no action).
- **FR-023**: If using polling (fallback or primary): the system MUST periodically (e.g., every 5–15 minutes) check the tracked branch HEAD via GitHub API; if it differs from the stored commit, trigger regeneration.
- **FR-024**: Webhook registration MUST be documented; users (or the system) MUST be able to add a webhook to their repo pointing to the WikiSmith endpoint. For MVP, manual webhook setup by the user may be required; auto-registration via GitHub App is a future enhancement.

### 4.6 Race Conditions & Idempotency

- **FR-025**: When multiple pushes arrive in quick succession, the system MUST process them in a way that avoids redundant or conflicting regenerations.
- **FR-026**: The system MUST implement one of: (a) **debouncing**—ignore pushes for N seconds after the last one, then regenerate for the latest HEAD; (b) **queue with deduplication**—only the latest commit for a given repo/branch is queued; (c) **cancel-in-flight**—if a regeneration is in progress and a new push arrives, cancel the current job and start fresh for the new commit.
- **FR-027**: Recommendation: **Queue with deduplication**—each regeneration job is keyed by `owner/repo/branch`; only one job per key runs at a time; if a new push arrives while a job is queued (not yet started), update the job to use the new commit SHA.
- **FR-028**: The system MUST NOT produce duplicate wiki versions for the same commit SHA; idempotency key = `owner/repo/commitSha`.

### 4.7 Version History

- **FR-029**: The system MUST retain a configurable number N of previous wiki versions (e.g., N=5 or N=10); older versions MAY be pruned or archived.
- **FR-030**: Version history MUST be queryable: list versions for `owner/repo` with `commitSha`, `generatedAt`, `branch`, and optional `commitMessage` (from GitHub API).
- **FR-031**: Users MUST be able to view a previous wiki version by navigating to its URL (e.g., `/wiki/owner/repo/abc1234`).
- **FR-032**: The version history UI MUST show: commit SHA (short and full), branch, timestamp, and optional "View" / "Compare" actions.
- **FR-033**: Pruning of old versions MUST occur when a new version is added and the count exceeds N; the oldest version(s) are removed. Storage backend must support efficient deletion.

### 4.8 Repo Deletion & Access Loss

- **FR-034**: If the repository is deleted on GitHub, the system MUST: (a) retain existing wiki versions (read-only) for a grace period (e.g., 30 days), (b) mark the wiki as "repository deleted" and disable auto-updates, (c) eventually prune or archive per data retention policy.
- **FR-035**: If the user loses access (e.g., repo made private, user removed from org), the system MUST: (a) surface an error when attempting to regenerate, (b) optionally retain cached wiki for read-only access with a "may be stale" banner.
- **FR-036**: Webhook delivery will fail for deleted repos; the system SHOULD handle 404s from GitHub API gracefully when verifying repo state.

### 4.9 Generation Status & Feedback

- **FR-037**: The wiki home page (and metadata API) MUST display current status: `ready`, `updating`, or `failed`.
- **FR-038**: When status is `updating`, the UI MUST show a clear indicator (e.g., banner, badge) with message such as "Wiki is being updated to the latest commit. You're viewing the previous version."
- **FR-039**: When status is `failed`, the UI MUST show the error reason and a "Retry" or "Contact support" action where applicable.
- **FR-040**: The system MAY support optional notifications (e.g., email, in-app) when regeneration completes or fails—out of scope for MVP, design for extensibility.

## 5. Non-Functional Requirements (with NFR-xxx IDs)

- **NFR-001**: Webhook verification MUST complete in < 50ms; invalid signatures MUST be rejected before any heavy processing.
- **NFR-002**: The webhook endpoint MUST respond with 200 within 30 seconds to avoid GitHub retries; actual regeneration runs asynchronously.
- **NFR-003**: Version history queries MUST return within 500ms for up to 50 versions per repo.
- **NFR-004**: The system MUST NOT leak webhook secrets, tokens, or repo metadata in logs or error responses.
- **NFR-005**: Regeneration jobs MUST be resilient: retry on transient failures (e.g., GitHub API timeout) with exponential backoff; after N retries, mark as failed and alert.
- **NFR-006**: Storage schema MUST support efficient lookup by `owner/repo`, `owner/repo/commitSha`, and `owner/repo/branch` for current version.
- **NFR-007**: The versioning system MUST integrate with existing wiki storage (Neon Postgres, Vercel Blob, etc.) without requiring a separate storage backend for metadata.

## 6. UI/UX Requirements

### 6.1 Wiki Metadata Display

- **UI-001**: The wiki home page MUST display: "Generated from commit `abc1234` on branch `main`" (or equivalent) with a link to the GitHub commit.
- **UI-002**: A "View on GitHub" or "View commit" link MUST open the commit page: `https://github.com/{owner}/{repo}/commit/{commitSha}`.
- **UI-003**: The generated-at timestamp MUST be visible (e.g., "Last updated: 2 hours ago").

### 6.2 Status Indicators

- **UI-004**: When the wiki is updating, a prominent banner MUST appear: "Wiki is being updated to the latest commit. You're viewing the previous version." with optional progress indicator.
- **UI-005**: When update fails, a banner MUST show: "Update failed: [reason]. Retry?" with a retry button.
- **UI-006**: Status indicators MUST use clear, accessible colors and icons (e.g., yellow/amber for updating, red for failed).

### 6.3 Version History

- **UI-007**: A "Version history" or "Previous versions" section/link MUST be available from the wiki home or settings.
- **UI-008**: The version list MUST show: commit SHA (short), branch, date, and "View" link for each version.
- **UI-009**: Users MUST be able to navigate to any previous version via its URL or from the version list.

### 6.4 Branch Tracking Configuration

- **UI-010**: Users MUST be able to configure the tracked branch (e.g., in repo settings or wiki settings).
- **UI-011**: The branch selector MUST show the repo's default branch as the default option; users can choose another branch from a list (fetched from GitHub API).
- **UI-012**: Changing the tracked branch MUST require confirmation; show impact: "Wiki will auto-update when you push to [branch]."

### 6.5 Webhook Setup (if manual)

- **UI-013**: If webhook setup is manual, the UI MUST provide clear instructions: webhook URL, secret (if user-generated), events to select (`push`), and how to verify it's working.
- **UI-014**: The UI MAY show webhook delivery status (e.g., "Last delivery: 2 hours ago") if GitHub provides it via API—optional for MVP.

## 7. Technical Considerations

### 7.1 Push Detection: Webhooks vs. GitHub App vs. Polling

| Option | Pros | Cons |
|-------|------|------|
| **GitHub Webhooks** | Real-time; no polling; standard approach | Requires public endpoint; user must add webhook (or we do it via API with token); one webhook per repo |
| **GitHub App** | Org-wide install; auto webhook registration; better permissions | More setup; OAuth/install flow; overkill for MVP |
| **Polling** | No webhook setup; works for any repo | Not real-time (5–15 min delay); more API calls; rate limit concerns |

**Recommendation**: Start with **GitHub Webhooks** for MVP. Use a single webhook endpoint; users add the webhook to their repo (or we add it via GitHub API when user connects repo—requires `repo` scope). Consider GitHub App for org-wide adoption later.

### 7.2 Webhook Payload Structure

GitHub `push` event payload includes:

- `repository.full_name`, `repository.default_branch`
- `ref`: e.g., `refs/heads/main`
- `after`: commit SHA of the new HEAD
- `commits`: array of commits in the push

Filter: `ref === 'refs/heads/' + trackedBranch` → trigger regeneration for `after`.

### 7.3 Webhook Signature Verification

```ts
// Pseudocode
const signature = req.headers['x-hub-signature-256'];
const payload = req.body; // raw body for verification
const expected = 'sha256=' + crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
if (signature !== expected) return 401;
```

**Critical**: Use raw body for verification; Next.js may parse JSON by default—ensure raw body is available for webhook routes.

### 7.4 Job Queue for Regeneration

- **Inngest**, **Trigger.dev**, or **Vercel Background Functions**: Enqueue regeneration job from webhook handler.
- **Job payload**: `{ owner, repo, branch, commitSha }`
- **Idempotency**: If a job for the same `owner/repo/branch` is already queued or running, either (a) update the job's commitSha to the latest, or (b) skip and let the in-flight job complete, then trigger a new one if HEAD has changed.
- **Deduplication window**: 5–10 minutes—if two pushes for same branch within window, only regenerate for the latest.

### 7.5 Storage Schema (Neon Postgres)

```sql
-- Wiki version metadata
CREATE TABLE wiki_versions (
  id UUID PRIMARY KEY,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  branch TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL, -- 'ready' | 'updating' | 'failed'
  error_message TEXT,
  content_ref TEXT, -- e.g., Vercel Blob path or storage key
  UNIQUE(owner, repo, commit_sha)
);

-- Tracked branch config
CREATE TABLE wiki_tracking (
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  tracked_branch TEXT NOT NULL,
  default_branch TEXT NOT NULL,
  webhook_id BIGINT, -- GitHub webhook ID if we registered it
  PRIMARY KEY (owner, repo)
);

-- Index for "current" version lookup
CREATE INDEX idx_wiki_current ON wiki_versions (owner, repo, branch, generated_at DESC);
```

### 7.6 Incremental Updates (Out of Scope for MVP)

- **Full regeneration**: Re-run ingestion → analysis → classification → generation for the new commit. Simpler, guaranteed consistency.
- **Incremental**: Diff old vs. new commit, re-analyze only changed files, merge into existing wiki. Faster for large repos but complex; defer to future.

### 7.7 URL Routing

- `/wiki/[owner]/[repo]` → resolve to current HEAD of tracked branch; if no wiki, show "Generate" or 404.
- `/wiki/[owner]/[repo]/[commitSha]` → serve wiki for that exact commit; 404 if not found.
- `/wiki/[owner]/[repo]?ref=[branch]` → resolve branch HEAD, serve that version (or redirect to commit URL for stability).

### 7.8 Package Boundaries

- Versioning logic may live in `apps/web` (API routes, webhook handler) or a new `packages/versioning` package.
- Shared types in `packages/shared`: `WikiVersion`, `WikiTrackingConfig`, `WebhookPayload`.
- Depends on: ingestion, analyzer, generator, storage—orchestration in `apps/web` or a jobs package.

## 8. Dependencies

- **Repository Ingestion**: Must support fetching at a specific commit SHA. See `repository-ingestion-discovery-prd.md` FR-006.
- **Wiki Content Generation**: Generator consumes commit SHA for citation URLs. See `wiki-content-generation-prd.md` FR-012, FR-013.
- **Deployment & Storage**: Wiki storage (Neon, Vercel Blob) must support versioned keys (`owner/repo/commitSha`). See `deployment-infrastructure-prd.md` FR-020–FR-023.
- **GitHub API**: Required for: default branch, branch list, commit metadata, optional webhook registration. Requires `GITHUB_TOKEN` or user token.
- **Job Queue**: Inngest, Trigger.dev, or Vercel Background Functions for async regeneration.
- **WorkOS Auth**: User identity for "who configured tracking" and access control (if we restrict who can set up auto-update).

## 9. Success Metrics

- **SM-1**: 95% of webhook deliveries for valid push events result in regeneration job enqueued within 5 seconds.
- **SM-2**: 100% of webhook requests with invalid signatures are rejected (no unauthorized regeneration).
- **SM-3**: Zero duplicate wiki versions for the same commit SHA (idempotency).
- **SM-4**: Race condition handling: when 2+ pushes within 60 seconds, only one regeneration runs for the latest commit; no conflicting versions.
- **SM-5**: Version history: users can view at least the last 5 versions for 95% of wikis with auto-update enabled.
- **SM-6**: "Updating" status is visible within 10 seconds of push; users see previous version until new one is ready.
- **SM-7**: Repo deletion / access loss: appropriate error or banner shown; no 500s from missing repo.

## 10. Out of Scope

- **Incremental/delta regeneration**: Full pipeline run per update; no diff-based optimization for MVP.
- **GitHub App for auto webhook registration**: Manual webhook setup or API-based registration with user token for MVP.
- **Diff between wiki versions**: Comparing two versions side-by-side or showing a diff view—stretch goal.
- **Multi-branch tracking**: Tracking multiple branches per repo produces multiple wikis—future enhancement.
- **Tag-based versioning**: Wikis for specific tags (e.g., `v1.0.0`) without branch tracking—possible via manual generation with `?ref=v1.0.0`; auto-update on tag push is future work.
- **Webhook delivery status dashboard**: Showing success/failure of webhook deliveries—optional polish.
- **Email/in-app notifications** on update complete or fail—extensibility only for MVP.
- **Rollback as "promote to current"**: Making an old version the "current" one without regeneration—future enhancement.

## 11. Open Questions

- **OQ-1**: Who can configure branch tracking? Any user who generated the wiki, or only repo admins? WorkOS auth + GitHub API can check repo permissions.
- **OQ-2**: Do we auto-register webhooks when a user enables tracking, or require manual setup? Auto-registration needs `repo` scope (admin); manual is simpler but higher friction.
- **OQ-3**: Default N for version history retention? 5, 10, or configurable per repo?
- **OQ-4**: Should `/wiki/owner/repo` always resolve to "latest" (tracked branch HEAD), or allow pinning to a branch in the URL (e.g., `?ref=main` vs `?ref=develop`)?
- **OQ-5**: For private repos (future): webhook secret per-repo or global? Per-repo is more secure but complex.
- **OQ-6**: If polling is used as fallback, what interval? 5 min balances freshness vs. API rate limits.
- **OQ-7**: Grace period for deleted repos—30 days? 90? Legal/data retention implications?
- **OQ-8**: Should we support "pause auto-updates" (user disables without changing branch)?

## Implementation Status

> Last updated: 2026-02-25

### What's Implemented
- Nothing yet; blocked by Auth and Generation integration

### What's Not Yet Implemented
- Commit-pinned wiki metadata
- URL structure for versions
- Branch tracking
- Webhook endpoint for GitHub push events
- Auto-update on push
- Version history
- All features described in this PRD

### Current Limitations
- No versioning; each generation overwrites. Depends on Auth (for user-scoped config), Generation (for pipeline), and DB (for wiki storage) being fully integrated.

## 12. Milestones

### M1: Commit-Pinned Wikis & URL Structure (1–2 weeks)

- FR-001, FR-002, FR-003, FR-004, FR-005 (commit-pinned metadata)
- FR-006, FR-007, FR-008, FR-009 (URL structure)
- Storage schema for `wiki_versions`; migration
- UI-001, UI-002, UI-003 (metadata display)
- Integration: ingestion and generator accept commit SHA; citations use correct ref

**Deliverable**: Every wiki is stored with commit SHA; URLs support `/wiki/owner/repo` and `/wiki/owner/repo/commitSha`; users see commit and branch on wiki home.

### M2: Branch Tracking & Webhook Infrastructure (1–2 weeks)

- FR-010, FR-011, FR-012, FR-013 (branch tracking)
- FR-019, FR-020, FR-021, FR-022 (webhook endpoint, verification)
- FR-025, FR-026, FR-027, FR-028 (race conditions, idempotency)
- NFR-001, NFR-002, NFR-004 (webhook perf, security)
- UI-010, UI-011, UI-012 (branch config)
- UI-013 (webhook setup instructions if manual)

**Deliverable**: Users can set tracked branch; webhook endpoint accepts and verifies GitHub push events; regeneration job enqueued; no duplicate jobs for same commit.

### M3: Auto-Update Flow & Status UX (1 week)

- FR-014, FR-015, FR-016, FR-017, FR-018 (auto-update on push)
- FR-037, FR-038, FR-039, FR-040 (status feedback)
- UI-004, UI-005, UI-006 (status indicators)
- Job queue integration (Inngest/Trigger.dev)
- End-to-end: push → webhook → job → regeneration → new wiki live

**Deliverable**: Push to tracked branch triggers regeneration; users see "updating" banner; previous version served until new one ready; failure handling.

### M4: Version History (1 week)

- FR-029, FR-030, FR-031, FR-032, FR-033 (version history)
- UI-007, UI-008, UI-009 (version history UI)
- NFR-003, NFR-006, NFR-007 (storage, schema)
- Pruning logic when exceeding N versions

**Deliverable**: Users can view last N wiki versions; navigate to any version by URL; old versions pruned automatically.

### M5: Edge Cases & Hardening (1 week)

- FR-034, FR-035, FR-036 (repo deletion, access loss)
- NFR-005 (retry, resilience)
- Polling fallback (FR-023) if webhooks are unreliable—optional
- Documentation, ADR for webhook strategy and storage schema

**Deliverable**: Graceful handling of deleted repos and access loss; retry logic for failed jobs; production-ready.
