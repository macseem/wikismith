# Public AI Wiki Sharing — PRD

## 1. Goal

Enable wiki owners to publish read-only AI-generated wikis via shareable links and optional website embeds without requiring viewer authentication.

## 2. Problem Statement

Today, wiki access is effectively user-scoped: generated wiki retrieval is tied to a user context, and there is no first-class publishing model. This blocks a core workflow for documentation tools: sharing generated docs with teammates, stakeholders, or external audiences. It also blocks distribution use cases where users want to place AI wiki pages on their own websites.

## 3. User Stories

- As a wiki owner, I want to publish a wiki and copy a public link so others can read it without signing in.
- As a wiki owner, I want to unpublish or rotate the share link so I can revoke prior access.
- As a viewer, I want to open a shared wiki URL and navigate pages without auth prompts.
- As a wiki owner, I want an embeddable version of a page so I can place docs on my website.
- As a viewer, I want embedded wiki content to be readable and consistent with the hosted version.

## 4. Functional Requirements

### 4.1 Visibility and Access Controls

- FR-001: Wikis MUST be private by default.
- FR-002: Owners MUST be able to set wiki visibility to `public` or `private` from the dashboard.
- FR-003: Public wikis MUST be accessible without authentication through a share URL.
- FR-004: Private or revoked share URLs MUST return `404` (not `401`) to reduce resource enumeration.
- FR-005: Only the owning user MUST be allowed to change visibility, rotate tokens, or toggle embedding.

### 4.2 Share Link Model and Routing

- FR-006: Public sharing MUST use an unguessable token (UUID or equivalent high-entropy identifier).
- FR-007: Share links MUST remain stable across wiki regenerations and point to the latest ready wiki version.
- FR-008: Share links MUST support page navigation (overview and subpages) and preserve deep links.
- FR-009: Owners MUST be able to rotate share tokens; old tokens MUST become invalid immediately.
- FR-010: Public routes MUST be indexable only when explicitly enabled by product policy (default: noindex).

### 4.3 Embedded Wiki Delivery

- FR-011: The system MUST provide an embed-ready route for public wiki pages.
- FR-012: Owners MUST be able to enable/disable embedding independently from public visibility.
- FR-013: When embedding is disabled, embed routes MUST return `404`.
- FR-014: Embedded pages MUST render in read-only mode and hide owner-only controls.
- FR-015: Dashboard UI MUST provide copyable iframe snippet and direct embed URL.

### 4.4 Dashboard UX

- FR-016: Repository dashboard MUST expose a "Sharing" control surface per wiki.
- FR-017: Sharing UI MUST include: visibility toggle, copy public link action, rotate link action, embed toggle, copy embed snippet.
- FR-018: Sharing UI MUST show current status (Private/Public, Embed On/Off, last token rotation timestamp).

### 4.5 API and Contracts

- FR-019: Backend MUST expose typed contracts for fetching public wiki content by share token.
- FR-020: Backend MUST expose typed contracts for owner share settings mutation.
- FR-021: Public wiki retrieval MUST return the same page schema as private wiki retrieval.

## 5. Non-Functional Requirements

- NFR-001: Share token entropy MUST be at least 128 bits.
- NFR-002: Public read endpoints MUST be cache-friendly and support CDN caching for anonymous traffic.
- NFR-003: Public and embed endpoints MUST include abuse protections (rate limiting and request logging).
- NFR-004: Access-control checks MUST complete within existing API latency budgets.
- NFR-005: Changes to sharing settings MUST be auditable in structured logs.

## 6. UI/UX Requirements

- Sharing controls belong in dashboard repository actions, not hidden in advanced settings.
- Copy actions MUST provide immediate success/error feedback.
- Rotating a token MUST require confirmation and clearly communicate that previous links will stop working.
- Public wiki pages MUST keep navigation parity with authenticated wiki pages but remove account/menu actions.
- Embed pages MUST use a compact chrome suitable for iframes (content-first layout).

## 7. Technical Considerations

- Data model should represent sharing at repository wiki scope (not per version), so links survive regeneration.
- Recommended schema direction: add a dedicated `wiki_shares` table keyed by `repository_id` with fields for `is_public`, `share_token`, `embed_enabled`, `token_rotated_at`, and timestamps.
- `apps/web/src/lib/wiki-store.ts` currently resolves anonymous access by `owner/repo` and latest non-private repository row; this is insufficient for explicit sharing and must be replaced/augmented with token-based resolution.
- Add explicit public routes in middleware policy for share and embed paths while preserving existing protected dashboard/api paths.
- Extend `@wikismith/contracts` with public wiki read contracts and share settings contracts to keep FE/BE types aligned.
- Ensure canonical URL strategy is documented for SEO/noindex behavior and duplicate-content handling.

## 8. Dependencies

- Existing auth/session foundation (WorkOS) for owner permission checks.
- Database migration capability in `packages/db` for sharing metadata.
- Typed API contracts in `packages/contracts`.
- Wiki rendering pipeline in `apps/web` with read-only mode support.
- Dashboard repository actions UI to host sharing controls.

## 9. Success Metrics

- SM-001: At least 90% of users who enable sharing can open the public link successfully on first attempt.
- SM-002: Public wiki page p95 response time remains within established wiki-read SLA.
- SM-003: Token rotation invalidates previous link access within 1 minute in 99.9% of cases.
- SM-004: Embed route renders successfully across major browsers (Chromium, Firefox, Safari) in CI/manual validation.
- SM-005: Zero unauthorized share-setting mutations in security test suite.

## 10. Out of Scope

- Role-based sharing (viewer/editor invites).
- Per-page ACLs.
- Password-protected public links.
- Analytics dashboard for link views.
- Cross-repo public wiki discovery marketplace.

## 11. Open Questions

- OQ-001: Should canonical public URLs use only token paths, or support owner/repo vanity paths when public?
- OQ-002: Should public pages be fully crawlable, noindex by default, or configurable per wiki?
- OQ-003: Should embed be opt-in default off for all public wikis, or inherit from public visibility initially?
- OQ-004: Do we need signed short-lived embed tokens for higher-security enterprise scenarios in v1?
- OQ-005: Should token rotation preserve old links for a grace period or invalidate immediately?

## 12. Milestones

- M1: Data model + migration + server access policy for public/share/embed routes.
- M2: Public wiki read endpoints + typed contracts + token resolution.
- M3: Dashboard sharing controls (toggle/copy/rotate/embed) and owner authorization checks.
- M4: Embed route UX and read-only wiki shell.
- M5: E2E/security/performance validation and rollout guardrails.

## 13. Acceptance Criteria

- AC-001: Given a private wiki, when an unauthenticated viewer opens its share URL, then the response is `404`.
- AC-002: Given an owner enables public sharing, when an unauthenticated viewer opens the share URL, then wiki overview and child pages render read-only.
- AC-003: Given an owner rotates the share token, when the previous URL is opened, then access fails (`404`) and the new URL succeeds.
- AC-004: Given embed is disabled, when an iframe loads the embed URL, then the response is `404`.
- AC-005: Given embed is enabled, when an iframe loads the embed URL, then content renders without owner controls and with stable navigation.
- AC-006: Given a non-owner authenticated user calls share settings mutation endpoints, then the response is `403`.
- AC-007: Given a public wiki is regenerated, when the same share URL is opened, then it resolves to the latest `ready` version.

## 14. Proposed Routes and Contracts (Draft)

- Public routes:
  - `GET /s/[shareToken]` -> overview page render
  - `GET /s/[shareToken]/[...slug]` -> child page render
  - `GET /embed/[shareToken]` -> embed overview render
  - `GET /embed/[shareToken]/[...slug]` -> embed child page render
- Owner settings API routes:
  - `GET /api/repos/[owner]/[repo]/sharing` -> current sharing settings
  - `PATCH /api/repos/[owner]/[repo]/sharing` -> toggle `isPublic` / `embedEnabled`
  - `POST /api/repos/[owner]/[repo]/sharing/rotate` -> rotate token
- Contract additions in `packages/contracts`:
  - `apiContracts.wiki.public.getByShareToken`
  - `apiContracts.repos.sharing.get`
  - `apiContracts.repos.sharing.update`
  - `apiContracts.repos.sharing.rotate`

## 15. Risks and Mitigations

- Risk: token leakage via logs/referrers.
  - Mitigation: avoid logging raw tokens; redact token fields in server logs.
- Risk: anonymous traffic abuse on public endpoints.
  - Mitigation: add IP-based rate limiting and CDN caching with bounded TTL.
- Risk: duplicate content indexing between authenticated and shared pages.
  - Mitigation: set canonical tags and default `noindex` policy for shared pages until policy is finalized.
- Risk: accidental broad access from middleware routing mistakes.
  - Mitigation: explicit allowlist for public/share/embed paths with tests for protected paths.
