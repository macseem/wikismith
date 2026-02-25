# Repository Management — PRD

## 1. Goal

Deliver a dashboard where users manage their connected GitHub repositories, trigger wiki generation, and browse their wiki collection—enabling a seamless flow from "connect repo" to "view wiki" for both public and private repositories. The dashboard is the primary entry point for authenticated users and must feel responsive, trustworthy, and developer-grade.

## 2. Problem Statement

WikiSmith generates wikis from GitHub repositories, but users need a central place to:

- **Discover and select repos** — Users have many repos (public and private); they need to browse, search, and pick which ones to document
- **Trigger generation** — One-click or explicit action to start wiki generation for a selected repo
- **Track status** — Generation takes minutes; users need clear visibility into "not generated", "generating", "ready", or "failed"
- **Manage settings** — Branch to track, auto-update preferences, and delete wikis when no longer needed
- **Access private repos** — Private repos require GitHub OAuth; tokens must be stored securely and re-authorization prompted when scopes are insufficient

Without a well-designed repository management dashboard, users cannot efficiently manage their wiki collection, leading to friction, confusion about status, and inability to leverage private repo access.

## 3. User Stories

- As a **developer with many GitHub repos**, I want to browse my repos (public and private) in a searchable, filterable list so that I can quickly find the one I want to document.
- As a **developer**, I want each repo card to show name, description, language, last updated, and wiki status so that I can see at a glance which repos have wikis and which need generation.
- As a **developer**, I want to select a repo and trigger wiki generation with one click so that I can document my codebase without manual setup.
- As a **developer**, I want to paste a GitHub URL for any public repo (even without logging in) so that I can try WikiSmith on public repos before signing up.
- As a **developer with private repos**, I want to connect my GitHub account via OAuth so that I can generate wikis for my private repositories.
- As a **developer**, I want to be prompted to re-authorize with expanded scopes if my token lacks permissions so that I understand why private repo access failed and how to fix it.
- As a **developer**, I want to configure which branch to track and whether to auto-update the wiki so that I control how my wiki stays in sync with the repo.
- As a **developer**, I want to delete a wiki when I no longer need it so that I can manage my wiki collection.
- As a **developer**, I want the repo list to load quickly without hitting GitHub on every page load so that the dashboard feels responsive.
- As a **developer**, I want pagination, search, and filtering (by language, has wiki, etc.) so that I can navigate large repo lists efficiently.

## 4. Functional Requirements (with FR-xxx IDs)

### 4.1 Repo List Dashboard

- **FR-001**: The dashboard MUST display a list of GitHub repositories available to the user (public repos the user has access to + private repos when authenticated).
- **FR-002**: Each repo card MUST display: (a) repository name, (b) owner, (c) description (truncated if long), (d) primary language, (e) last updated timestamp, (f) wiki status (not generated / generating / ready / failed).
- **FR-003**: Repo cards MUST be clickable or have a clear action (e.g., "Generate wiki", "View wiki") based on wiki status.
- **FR-004**: The dashboard MUST support pagination for repo lists; page size configurable (default 12–24 per page).
- **FR-005**: The dashboard MUST support search by repo name or owner; search MUST filter the displayed list (client-side or server-side).
- **FR-006**: The dashboard MUST support filtering by: (a) primary language, (b) wiki status (has wiki / no wiki / failed), (c) visibility (public / private) when applicable.
- **FR-007**: The dashboard MUST show an empty state when no repos are found or user has no connected account, with clear CTAs (e.g., "Connect GitHub", "Paste a URL").
- **FR-008**: The dashboard MUST show a loading state while fetching repo list; skeleton cards or spinner acceptable.

### 4.2 Repo List Data Source

- **FR-009**: For authenticated users, the repo list MUST be fetched from the GitHub API using the user's OAuth token (obtained via WorkOS GitHub OAuth).
- **FR-010**: The GitHub API request MUST use the token-authenticated endpoint (e.g., `GET /user/repos` with `type=all` for owned + collaborated repos, or `GET /repos` for org repos as needed).
- **FR-011**: The repo list MUST be cached; the system MUST NOT fetch from GitHub on every page load.
- **FR-012**: Cache TTL MUST be configurable (recommend 5–15 minutes); cache key MUST include user ID.
- **FR-013**: The dashboard MUST provide a "Refresh" action to invalidate cache and re-fetch from GitHub on demand.
- **FR-014**: When fetching repos, the system MUST respect GitHub API rate limits (5,000 req/hr for token-authenticated requests); implement backoff and surface rate-limit errors to the user.

### 4.3 URL Paste (Public Repos)

- **FR-015**: Users MUST be able to paste a GitHub repository URL (e.g., `https://github.com/owner/repo`) to add or generate a wiki for a public repo.
- **FR-016**: URL paste MUST work for unauthenticated users when the repo is public; no OAuth required for public-only flow.
- **FR-017**: The system MUST parse and validate the URL format; support `https://github.com/owner/repo`, `owner/repo`, and common variants.
- **FR-018**: Invalid URLs MUST show a clear error (e.g., "Invalid GitHub URL", "Repository not found").
- **FR-019**: For public repos added via URL paste without auth, the system MUST NOT store a user association; wiki is accessible via direct link.

### 4.4 Private Repo Access & Token Management

- **FR-020**: Private repo access MUST use the GitHub access token obtained during WorkOS GitHub OAuth.
- **FR-021**: The GitHub token MUST be stored encrypted in Neon (PostgreSQL); associated with the user record.
- **FR-022**: Token storage MUST use encryption at rest; key management via environment variable or Vercel/KMS.
- **FR-023**: If the token lacks required scopes (e.g., `repo` for private repos), the system MUST prompt the user to re-authorize with expanded scopes.
- **FR-024**: The re-authorization prompt MUST explain which scopes are needed and why (e.g., "WikiSmith needs access to your private repositories to generate wikis").
- **FR-025**: When token is expired or revoked, the system MUST detect 401/403 from GitHub API and prompt re-authentication.
- **FR-026**: The system MUST NOT expose raw tokens in logs, API responses, or client-side code.

### 4.5 Wiki Generation Trigger

- **FR-027**: Users MUST be able to trigger wiki generation for a selected repo via a clear action (e.g., "Generate wiki" button).
- **FR-028**: Before generation, the system MUST validate: (a) repo exists and is accessible, (b) user has permission (or repo is public), (c) token has sufficient scopes for private repos.
- **FR-029**: When generation is triggered, the UI MUST transition to a generation status view (or show inline progress) per Wiki UI PRD (FR-041–FR-048).
- **FR-030**: If a wiki is already "generating" for a repo, the system MUST NOT start a duplicate generation; show current status instead.
- **FR-031**: Users MUST be able to retry failed generations with one click.

### 4.6 Repo Settings

- **FR-032**: Each connected repo MUST have configurable settings: (a) branch to track (default: repo default branch), (b) auto-update toggle (re-generate wiki when branch changes).
- **FR-033**: Branch selection MUST list branches from the repo (fetched via GitHub API); default to `main` or `master` when available.
- **FR-034**: Auto-update toggle MUST be optional; when enabled, the system SHOULD trigger re-generation when the tracked branch has new commits (implementation may be async job).
- **FR-035**: Settings MUST be persisted per repo per user in Neon.
- **FR-036**: Settings MUST be editable from the repo card or a dedicated settings modal/page.

### 4.7 Delete Wiki

- **FR-037**: Users MUST be able to delete a generated wiki for a repo they own or have access to.
- **FR-038**: Delete MUST require confirmation (e.g., modal: "Are you sure? This cannot be undone.").
- **FR-039**: After delete, the repo card MUST show "not generated" status; wiki content MUST be removed from storage.
- **FR-040**: Delete MUST NOT remove the repo from the user's list; only the generated wiki content is deleted.

### 4.8 Wiki Status

- **FR-041**: Wiki status MUST be one of: `not_generated`, `generating`, `ready`, `failed`.
- **FR-042**: `generating` MUST show progress indication (e.g., "Generating…", progress stages if available).
- **FR-043**: `failed` MUST display the error reason and a retry action.
- **FR-044**: Status MUST be persisted in Neon and synced with the generation pipeline (job status).
- **FR-045**: Status updates MAY use polling or real-time (SSE/WebSocket); polling acceptable for MVP.

## 5. Non-Functional Requirements (with NFR-xxx IDs)

- **NFR-001**: Repo list (cached) MUST load within 2 seconds p95 when cache hit; within 5 seconds p95 on cache miss (GitHub API fetch).
- **NFR-002**: GitHub API rate limits: token-authenticated = 5,000 req/hr; design caching to minimize API calls (e.g., one fetch per user per TTL).
- **NFR-003**: Token storage MUST use encryption; key rotation strategy documented.
- **NFR-004**: The dashboard MUST be responsive: usable on viewports from 375px (mobile) to 1920px+ (desktop).
- **NFR-005**: The dashboard MUST meet WCAG 2.1 Level AA for accessibility (contrast, focus indicators, screen reader support).
- **NFR-006**: No raw tokens or secrets in client-side code, logs, or error messages.
- **NFR-007**: Pagination and filtering MUST work without full page reload; client-side or server-side acceptable.

## 6. UI/UX Requirements

### 6.1 Design Principles

- **Scannable**: Repo cards must be easy to scan; key info (name, status) visible at a glance.
- **Action-oriented**: Primary actions (Generate, View wiki) must be prominent.
- **Trustworthy**: Token handling and private repo access must feel secure; clear messaging when re-auth is needed.
- **Responsive**: Dashboard must work on mobile for quick checks; full experience on desktop.

### 6.2 Component Library

- **shadcn/ui** as the base component library.
- **Tailwind CSS** for styling.
- **Lucide React** for icons.
- Consistent with Wiki UI design system (dark mode default, typography).

### 6.3 Page Structure

**Dashboard (Repos List)**

- Header: "Your Repositories" or "Repos" with search bar and filter dropdowns.
- "Paste URL" or "Add repo" input/button for URL paste flow.
- "Connect GitHub" CTA when unauthenticated or token missing.
- Grid or list of repo cards (responsive: 1 col mobile, 2–4 cols desktop).
- Pagination controls at bottom.
- Empty state: "No repos found" or "Connect GitHub to see your repos".

**Repo Card**

- Avatar or icon for repo.
- Repo name (link to GitHub) + owner.
- Description (1–2 lines, truncated).
- Language badge.
- Last updated (relative: "2 days ago").
- Wiki status badge (color-coded: gray=not generated, blue=generating, green=ready, red=failed).
- Primary action button: "Generate wiki" / "View wiki" / "Retry" / "Generating…".
- Secondary: settings icon, delete icon (when wiki exists).

**Repo Settings Modal**

- Branch dropdown (fetched from GitHub).
- Auto-update toggle with explanation.
- Save / Cancel.

**Re-authorization Prompt**

- Modal or inline banner when token lacks scopes.
- Clear explanation: "WikiSmith needs access to your private repositories."
- "Reconnect GitHub" button linking to OAuth flow with expanded scopes.

### 6.4 UI Review Checklist

- [ ] Repo cards are scannable; status visible at a glance
- [ ] Search and filters work correctly
- [ ] Loading states for repo list and generation
- [ ] Error states (rate limit, token expired) are actionable
- [ ] Empty states guide user (Connect GitHub, Paste URL)
- [ ] Delete confirmation prevents accidental deletion
- [ ] Responsive across breakpoints
- [ ] Keyboard navigation and focus management

## 7. Technical Considerations

### 7.1 Data Model (Neon)

**Users** (from WorkOS)

- `id`, `email`, `workos_user_id`, `created_at`, etc.

**User GitHub Tokens**

- `user_id` (FK), `encrypted_token`, `scopes`, `expires_at`, `created_at`, `updated_at`
- Encryption: use `crypto` with AES-256-GCM; key from `GITHUB_TOKEN_ENCRYPTION_KEY` env var.

**Repos** (user's connected / tracked repos)

- `id`, `user_id`, `owner`, `name`, `default_branch`, `tracked_branch`, `auto_update`, `wiki_status`, `wiki_job_id`, `created_at`, `updated_at`
- `wiki_status`: enum `not_generated | generating | ready | failed`
- Optional: cache `description`, `language`, `last_updated` from GitHub for display.

**Repo List Cache**

- Option A: Store in Neon as `user_repo_cache` (user_id, cached_at, json blob of repo list).
- Option B: Use Vercel KV with key `repos:{userId}`, TTL 5–15 min.
- Recommendation: Neon for consistency with user/repo data; KV if cache churn is high.

### 7.2 GitHub API Usage

- **List repos**: `GET /user/repos?type=all&sort=updated&per_page=100` (paginate with `page`)
- **Get repo**: `GET /repos/{owner}/{repo}` for single repo details
- **List branches**: `GET /repos/{owner}/{repo}/branches` for branch selector
- **Rate limit**: 5,000/hr authenticated; check `X-RateLimit-Remaining` header; implement backoff on 403/429.
- **Scopes required**: `repo` for private repos; `public_repo` for public only. WorkOS GitHub connection should request `repo` when private access is needed.

### 7.3 WorkOS Integration

- WorkOS Auth Kit or similar for OAuth flow.
- After GitHub OAuth, WorkOS returns access token; exchange or store for GitHub API calls.
- Ensure WorkOS is configured to request `repo` scope for private repo access.
- Re-auth flow: redirect to WorkOS with `prompt=consent` or equivalent to force re-authorization with updated scopes.

### 7.4 Caching Strategy

- **Cache key**: `repos:{userId}` or `repos:{userId}:{page}:{filters}`
- **TTL**: 5–15 minutes (configurable)
- **Invalidation**: On "Refresh" click; on new repo add; optionally on generation complete
- **Stale-while-revalidate**: Optional; show cached data, fetch in background, update when ready

### 7.5 URL Structure

- `/` or `/dashboard` — Repo list dashboard (default for authenticated users)
- `/dashboard/repos` — Explicit repos list
- `/dashboard/repos/[owner]/[repo]` — Repo detail / settings (optional)
- `/generate` or `/generate?repo=owner/repo` — Generation flow (from Wiki UI PRD)
- Unauthenticated: `/` shows landing + "Paste URL" input; redirect to dashboard after auth

### 7.6 Package Boundaries

- Dashboard UI lives in `apps/web`.
- API routes: `GET /api/repos` (list), `POST /api/repos/refresh`, `GET /api/repos/[owner]/[repo]` (detail), `PATCH /api/repos/[owner]/[repo]/settings`, `DELETE /api/repos/[owner]/[repo]/wiki`.
- Token encryption/decryption in server-side only; never expose to client.
- Shared types from `packages/shared` for `Repo`, `WikiStatus`, etc.

## 8. Dependencies

- **WorkOS**: Auth provider; must support GitHub OAuth and return GitHub access token (or provide mechanism to obtain it).
- **Neon (PostgreSQL)**: User data, token storage, repo settings, wiki status. Schema migrations required.
- **Repository Ingestion**: Generation pipeline consumes repo URL/ref; ingestion must support authenticated requests for private repos. See `repository-ingestion-discovery-prd.md`.
- **Wiki Content Generation**: Generation pipeline produces wiki; status updates flow back to dashboard. See `wiki-content-generation-prd.md`.
- **Wiki UI & Navigation**: Generation flow UX (progress, errors) defined there. See `wiki-ui-navigation-prd.md`.
- **Deployment**: Token encryption key in env; Neon connection. See `deployment-infrastructure-prd.md`.
- **Shared types**: `packages/shared` must define `Repo`, `WikiStatus`, `RepoSettings` (or equivalent).

## 9. Success Metrics

- **SM-1**: 95% of authenticated users see their repo list within 5 seconds of dashboard load (cache hit or miss).
- **SM-2**: Cache hit rate ≥80% for repeat visits within TTL; GitHub API calls minimized.
- **SM-3**: Zero production incidents from token leakage (logs, client, API responses).
- **SM-4**: Re-authorization prompt appears when token lacks scopes; 80%+ of users who see it complete re-auth successfully.
- **SM-5**: URL paste flow works for 100% of valid public repo URLs (owner/repo format).
- **SM-6**: Delete wiki completes successfully; repo card reflects "not generated" within 2 seconds.
- **SM-7**: Pagination and filtering work correctly for users with 100+ repos.
- **SM-8**: Accessibility: Lighthouse accessibility score ≥90; passes axe-core with no critical issues.

## 10. Out of Scope

- **GitLab, Bitbucket**: GitHub only for MVP.
- **GitHub Enterprise / self-hosted**: GitHub.com only.
- **Org-level repo management**: User-level only; no org admin dashboard.
- **Bulk operations**: No "generate all" or "delete all"; one repo at a time.
- **Repo discovery beyond user's repos**: No "explore public wikis" or marketplace.
- **Webhooks for auto-update**: Polling or manual trigger for MVP; GitHub webhooks for auto-update are future work.
- **Multiple branches per repo**: One tracked branch per repo; no "compare branches" or multi-branch wikis.
- **Wiki version history**: Each generation overwrites; no version history in dashboard.
- **Sharing / permissions**: Wiki visibility tied to repo; no fine-grained sharing (future work).

## 11. Open Questions

- **OQ-1**: Does WorkOS return the GitHub token directly, or do we need a separate GitHub OAuth flow? Affects integration design.
- **OQ-2**: Cache backend: Neon table vs. Vercel KV? Neon keeps everything in one DB; KV may be faster for high churn.
- **OQ-3**: Auto-update: How do we detect "branch has new commits"? Poll GitHub API periodically, or use GitHub webhooks? Webhooks require a public endpoint.
- **OQ-4**: For URL paste without auth: Should we create an anonymous "session" or just allow generation and link wiki to URL? Affects wiki retrieval and ownership.
- **OQ-5**: Repo list: Include forked repos? Include repos from orgs the user belongs to? GitHub API `type=all` returns owned + collaborated; confirm scope.
- **OQ-6**: Token refresh: GitHub tokens can be long-lived; do we need refresh logic, or does WorkOS handle it?
- **OQ-7**: Rate limit handling: When we hit 5K/hr, do we show cached data only and disable refresh? Or queue and retry?
- **OQ-8**: Repo card layout: Grid vs. list view? Allow user preference?

## Implementation Status

> Last updated: 2026-02-25

### What Is Implemented

Implemented across Authentication + Repository Dashboard tickets (`86c8ez7tz`, `86c8ez7xk`):

- Protected `/dashboard` route with authenticated user context
- GitHub-backed repository list (token-authenticated) with cached fetches and manual refresh
- Repository cards with metadata (full name, description, language, visibility, last push)
- Wiki status badge support: `not_generated`, `generating`, `ready`, `failed`
- Search + filter (language/status) and cursor-style pagination controls
- In-dashboard URL paste flow for public/out-of-list repositories
- Per-repo actions: generate/regenerate, view wiki, delete wiki with confirmation
- Repository settings control: tracked branch + auto-update toggle persisted to `repositories`
- Re-auth prompts for missing provider scopes in dashboard and repo actions

### Current Limitations

- Repo settings are presented in an inline expandable panel rather than a dedicated modal component
- Wiki status persistence is hybrid (cache + DB-backed metadata); full DB-native wiki content/version pipeline remains future work
- Repo list cache is currently in-memory; Neon/KV-backed cache is optional future hardening for multi-instance scale

## 12. Milestones

### M0: Dashboard Baseline (Already Shipped)

- Protected dashboard route and account context
- In-dashboard wiki generation action
- Quota/status visibility and reconnect path
- Recent wiki shortcuts

**Deliverable**: Authenticated users have a functional operational home for generation and account checks, but not yet full repository management.

### M1: Repo List & Basic Dashboard (MVP)

- FR-001, FR-002, FR-003, FR-004, FR-007, FR-008 (repo list, cards, pagination, empty/loading states)
- FR-009, FR-010, FR-011, FR-012, FR-013, FR-014 (GitHub API fetch, caching, rate limits)
- FR-041, FR-042, FR-043, FR-044, FR-045 (wiki status display)
- NFR-001, NFR-002, NFR-006

**Deliverable**: Authenticated users see their GitHub repos in a paginated list; cached; status displayed. No URL paste or private repo yet.

### M2: URL Paste & Public Repo Flow

- FR-015, FR-016, FR-017, FR-018, FR-019 (URL paste for public repos)
- FR-027, FR-028, FR-029, FR-030, FR-031 (trigger generation, retry)
- Integration with generation pipeline

**Deliverable**: Users can paste a public repo URL and trigger wiki generation; works without auth for public repos.

### M3: Private Repo Access & Token Management

- FR-020, FR-021, FR-022, FR-023, FR-024, FR-025, FR-026 (token storage, encryption, re-auth)
- WorkOS GitHub OAuth integration
- Private repos appear in list when token has `repo` scope

**Deliverable**: Authenticated users can connect GitHub; token stored encrypted; private repos visible and generatable; re-auth prompt when scopes insufficient.

### M4: Search, Filtering & Repo Settings

- FR-005, FR-006 (search, filters)
- FR-032, FR-033, FR-034, FR-035, FR-036 (repo settings: branch, auto-update)
- NFR-007

**Deliverable**: Search and filter by language, status; repo settings modal with branch selector and auto-update toggle.

### M5: Delete Wiki & Polish

- FR-037, FR-038, FR-039, FR-040 (delete wiki)
- NFR-004, NFR-005 (responsive, accessibility)
- UI review checklist complete

**Deliverable**: Delete wiki with confirmation; dashboard responsive and accessible; production-ready.
