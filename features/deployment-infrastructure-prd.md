# Deployment & Infrastructure — PRD

## 1. Goal

Provide a production-ready deployment pipeline and infrastructure so that WikiSmith is publicly accessible at a stable URL, evaluators can explore it with zero local setup, and the system reliably runs the full wiki generation pipeline (ingestion → analysis → classification → generation) within the constraints of serverless and managed services.

## 2. Problem Statement

WikiSmith must be deployed and operational for users to benefit from it. Without deployment infrastructure:

- Evaluators and users cannot access the app—no public URL means no evaluation or demos
- Local setup (clone, install, env vars) creates friction and is error-prone
- The wiki generation pipeline is long-running (minutes) and may exceed typical serverless timeouts
- Generated wikis need durable storage—ephemeral serverless filesystems are unsuitable
- CI/CD is required for quality gates (lint, test, build) and reliable deployments
- Environment variables, secrets, and rate limits must be managed securely

Key challenges: Vercel's default 10s function timeout vs. wiki generation that can take 5–10+ minutes; where and how to store generated wikis; ensuring the public API is protected from abuse.

## 3. User Stories

- As an **evaluator**, I want to click a link and explore WikiSmith without installing anything locally, so that I can assess the product quickly.
- As a **user**, I want the app to be available at a stable public URL, so that I can generate wikis for my repositories.
- As a **WikiSmith developer**, I want every merge to main to trigger lint, type-check, tests, build, and deploy, so that we catch regressions before production.
- As a **WikiSmith developer**, I want preview deployments for each PR, so that I can test changes in a production-like environment before merging.
- As a **WikiSmith developer**, I want environment variables (OPENAI_API_KEY, GITHUB_TOKEN) managed securely, so that secrets never leak.
- As a **WikiSmith developer**, I want generated wikis to persist and be retrievable, so that users can view them after generation completes.
- As a **WikiSmith developer**, I want the long-running wiki generation to complete successfully, so that large repos are fully documented.
- As a **platform operator**, I want rate limiting on the public API, so that the service is protected from abuse.
- As a **platform operator**, I want visibility into errors and performance (optional for MVP), so that I can debug production issues.

## 4. Functional Requirements (with FR-xxx IDs)

### 4.1 Deployment Target

- **FR-001**: The app MUST be deployable to Vercel as the primary target; deployment MUST produce a publicly reachable URL.
- **FR-002**: Production deployments MUST occur automatically on merge to the `main` branch.
- **FR-003**: The production URL MUST be stable and documented (e.g., `wikismith.vercel.app` or custom domain).

### 4.2 CI/CD Pipeline

- **FR-004**: A CI pipeline MUST run on every push and pull request; it MUST execute: `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm build`.
- **FR-005**: The CI pipeline MUST fail the run if any of the above commands fail; no deployment on failure.
- **FR-006**: Deployment to production MUST occur only when the CI pipeline passes on the `main` branch.
- **FR-007**: CI MUST use GitHub Actions; workflow files MUST live in `.github/workflows/`.
- **FR-008**: CI MUST cache dependencies (e.g., pnpm store) to reduce run time.

### 4.3 Preview Deployments

- **FR-009**: Every pull request MUST trigger a preview deployment; the preview URL MUST be commentable or visible in the PR.
- **FR-010**: Preview deployments MUST use the same build and runtime configuration as production (excluding env overrides).
- **FR-011**: Preview deployments MAY use a subset of production environment variables (e.g., OPENAI_API_KEY for testing); secrets MUST NOT be exposed in logs or UI.

### 4.4 Environment Management

- **FR-012**: The app MUST read `OPENAI_API_KEY` from environment variables; generation MUST fail gracefully with a clear error if missing.
- **FR-013**: GitHub access uses per-user OAuth tokens obtained via WorkOS GitHub social login. For unauthenticated users (public repos only), the app MUST work with unauthenticated GitHub API limits and surface rate-limit errors clearly. See `authentication-authorization-prd.md`.
- **FR-014**: Environment variables MUST be configurable per environment (production, preview) in Vercel project settings.
- **FR-015**: No secrets (API keys, tokens) MUST be committed to the repository or logged.

### 4.5 Long-Running Wiki Generation

- **FR-016**: The system MUST support wiki generation that exceeds the default Vercel serverless timeout (10s).
- **FR-017**: The system MUST document the chosen strategy for long-running generation: (a) Vercel Serverless with extended timeout (Pro: up to 5 min), (b) Vercel Edge Functions, (c) external job runner (e.g., Inngest, Trigger.dev, or background worker), or (d) hybrid (quick response + async job).
- **FR-018**: If using async/job-based generation, the UI MUST provide status feedback (e.g., "Generating…", polling or WebSocket) and surface the wiki when complete.
- **FR-019**: Generation MUST NOT silently fail due to timeout; users MUST receive clear feedback (success, partial success, or error with reason).

### 4.6 Wiki Storage

- **FR-020**: Generated wikis MUST be stored in a durable backend; ephemeral filesystem (e.g., `/tmp`) is NOT acceptable for production.
- **FR-021**: The storage backend MUST support: (a) storing wiki content (markdown files or equivalent) keyed by repository identifier (e.g., `owner/repo` + `commitSha`), (b) retrieving by key, (c) optional TTL or eviction policy.
- **FR-022**: Storage backend is **Neon PostgreSQL with pgvector**. This stores users, repos, wiki versions, wiki pages, embeddings, and generation jobs. See `database-embeddings-prd.md` for full schema.
- **FR-023**: The storage schema MUST support: wiki metadata (repo, commit, generated-at), page content, and optional cache invalidation fields.

### 4.7 Rate Limiting

- **FR-024**: The public API (e.g., "generate wiki" endpoint) MUST implement rate limiting to protect against abuse.
- **FR-025**: Rate limits MUST be configurable (e.g., N requests per IP per hour, or per API key if added later).
- **FR-026**: When rate limited, the API MUST return HTTP 429 with a `Retry-After` header or equivalent; the UI MUST display a user-friendly "Too many requests, try again later" message.
- **FR-027**: Rate limiting SHOULD use Vercel's built-in options, Vercel KV, or a middleware (e.g., Upstash Rate Limit) compatible with serverless.

### 4.8 Error Handling & Observability

- **FR-028**: Unhandled errors in API routes MUST return appropriate HTTP status codes (4xx, 5xx) and structured error responses (no stack traces in production).
- **FR-029**: The app SHOULD integrate with an error-tracking service (e.g., Sentry) for MVP; if deferred, logging MUST be structured and sufficient for debugging.
- **FR-030**: Deployment and runtime configuration MUST be documented (e.g., README or `docs/deployment.md`) so that maintainers can reproduce the setup.

## 5. Non-Functional Requirements (with NFR-xxx IDs)

- **NFR-001**: Zero local setup for evaluators—the app MUST be fully usable via the production URL; no clone, install, or env configuration required.
- **NFR-002**: Production deployments MUST complete within 5 minutes of merge to main (from CI trigger to live URL).
- **NFR-003**: Preview deployments MUST complete within 5 minutes of PR push.
- **NFR-004**: CI pipeline runs MUST complete within 10 minutes for typical changes (excluding cache misses).
- **NFR-005**: The deployment MUST be reproducible; build artifacts MUST be deterministic where possible (e.g., lockfile committed).
- **NFR-006**: All secrets MUST be stored in Vercel's environment (or equivalent) and never in source code or CI logs.
- **NFR-007**: The infrastructure MUST support the monorepo structure (Turbo, pnpm workspaces); build MUST correctly handle `apps/web` and `packages/*`.

## 6. UI/UX Requirements

- **UI-001**: The production URL MUST serve a functional landing page or input form; users MUST be able to submit a GitHub repo URL without errors.
- **UI-002**: Loading and error states during wiki generation MUST be clear and actionable (e.g., "Generating wiki…", "Rate limited—try again in X minutes", "Generation failed: [reason]").
- **UI-003**: If wiki generation is async, the UI MUST show progress (e.g., spinner, status text) and transition to the wiki view when ready.
- **UI-004**: Error pages (404, 500) MUST be styled consistently with the app and provide helpful messages (e.g., "Something went wrong" with a link to retry or home).
- **UI-005**: No deployment-specific UI elements (e.g., "Preview" banners) are required for MVP unless they improve evaluator experience.

## 7. Technical Considerations

### 7.1 Vercel Configuration

- **Framework**: Next.js 15 app in `apps/web`; Vercel MUST be configured to use the correct root directory (e.g., `apps/web` or monorepo root with `turbo`).
- **Build command**: `pnpm build` or `turbo build --filter=@wikismith/web` (or equivalent).
- **Output**: Next.js static + server components; API routes for generation.
- **Function timeout**: Default 10s (Hobby); Pro allows up to 300s (5 min). Configure `maxDuration` in route config if using extended serverless.

### 7.2 Long-Running Generation Strategy

| Option | Pros | Cons |
|--------|------|------|
| **Vercel Serverless (5 min)** | No extra infra; simple | Pro plan required; 5 min may still be tight for large repos |
| **Edge Functions** | No cold starts; global | 30s limit; no long-running; may not fit generation |
| **External job runner** | No timeout; scalable | Extra service (Inngest, Trigger.dev, etc.); more complexity |
| **Hybrid** | Quick response; async job | Two-phase: accept request → background job → poll/notify |

**Recommendation**: Start with Vercel Serverless + extended timeout (5 min) for MVP. If large repos consistently exceed 5 min, add an external job runner (e.g., Inngest) in a follow-up phase.

### 7.3 Wiki Storage — Neon PostgreSQL + pgvector

**Decision**: Neon PostgreSQL is the primary storage backend. This is driven by:
1. Need for relational data (users, repos, wiki versions, pages)
2. pgvector for embeddings (RAG pipeline for Q&A and semantic search)
3. Drizzle ORM for type-safe queries and migrations
4. Neon's serverless driver (`@neondatabase/serverless`) works well with Vercel

Required environment variables:
- `DATABASE_URL` — Neon connection string (pooled)
- `DATABASE_URL_UNPOOLED` — For migrations

See `database-embeddings-prd.md` for full schema design.

### 7.4 CI/CD Workflow Structure

```yaml
# Example structure (not prescriptive)
on: [push, pull_request]
jobs:
  ci:
    - checkout
    - pnpm install --frozen-lockfile
    - pnpm lint
    - pnpm type-check
    - pnpm test
    - pnpm build
  deploy-preview:  # on push to PR branch
    - uses Vercel deploy (preview)
  deploy-prod:     # on push to main, after ci passes
    - uses Vercel deploy (production)
```

### 7.5 Rate Limiting Implementation

- **Vercel**: Edge middleware; rate limit by IP or header.
- **Upstash Rate Limit**: `@upstash/ratelimit` + Redis (Vercel KV compatible); configurable limits.
- **Simple in-memory**: Not suitable for serverless (multiple instances); use KV-backed solution.

### 7.6 Monorepo Build

- **Turborepo**: Configure `turbo.json` with pipeline: `build` depends on `^build`; `lint`, `test`, `type-check` as separate tasks.
- **Vercel**: Set root directory or use `vercel.json` to specify build command; ensure `packages/*` are built before `apps/web`.

## 8. Dependencies

- **Vercel account**: Pro plan recommended for 5 min function timeout; Hobby works for MVP with shorter timeouts or async generation.
- **GitHub repository**: Connected to Vercel for automatic deployments from `main` and previews from PRs.
- **Vercel project**: Created and linked; environment variables configured in dashboard.
- **Storage backend**: Neon PostgreSQL with pgvector — project created, connection string in `DATABASE_URL` env var.
- **WorkOS**: Account with GitHub social connection configured; `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `WORKOS_REDIRECT_URI` in env.
- **OpenAI API**: `OPENAI_API_KEY` with sufficient quota for generation.
- **GitHub token (optional)**: `GITHUB_TOKEN` for ingestion rate limits.
- **Error tracking (optional)**: Sentry project or equivalent; DSN in env.
- **Pipeline stages**: Ingestion, analysis, classification, and generation must be implemented (or stubbed) for end-to-end deployment; see respective PRDs.

## 9. Success Metrics

- **SM-1**: 100% of evaluators can access the app via the production URL without local setup.
- **SM-2**: CI pipeline runs on 100% of pushes and PRs; passes for green builds.
- **SM-3**: Production deployments succeed within 5 minutes of merge to main in 95% of cases.
- **SM-4**: Preview deployments succeed for 95% of PRs.
- **SM-5**: Wiki generation completes successfully for a typical repo (e.g., 20 features, 50K LOC) within the configured timeout.
- **SM-6**: Generated wikis persist and are retrievable after generation; no data loss from ephemeral storage.
- **SM-7**: Rate limiting returns 429 when limit exceeded; no abuse-induced outages.
- **SM-8**: Zero production incidents from leaked secrets (API keys, tokens).

## 10. Out of Scope

- **Multi-region deployment**: Single region (Vercel default) sufficient for MVP.
- **Custom domain**: Vercel default domain acceptable; custom domain is optional.
- **Self-hosted deployment**: Vercel-only for MVP; Docker or self-hosted is future work.
- **Staging environment**: Preview deployments serve as staging; dedicated staging env not required.
- **Kubernetes or bare metal**: Serverless only.
- **Advanced monitoring**: APM, custom dashboards, alerting—optional for MVP; basic Vercel analytics + optional Sentry sufficient.
- **Database migrations**: If using Postgres/SQLite, schema migrations are in scope for the storage layer; but not a full migration framework for MVP.
- **CDN customization**: Vercel's default CDN is sufficient.
- **A/B testing infrastructure**: Not in scope.

## 11. Open Questions

- **OQ-1**: Vercel plan: Hobby vs. Pro? Pro required for 5 min timeout; Pro also adds team features and higher limits.
- **OQ-2**: RESOLVED — Neon PostgreSQL + pgvector. See `database-embeddings-prd.md`.
- **OQ-3**: If wiki generation exceeds 5 min for large repos, should we add Inngest/Trigger.dev in MVP or defer to a follow-up?
- **OQ-4**: Rate limit values: 10 req/hour per IP? 60? 100? Depends on expected usage and cost.
- **OQ-5**: Sentry: include in MVP or defer? Error tracking improves debuggability but adds dependency and setup.
- **OQ-6**: Preview deployments: use production env vars (e.g., OPENAI_API_KEY) or a separate test key? Affects cost and isolation.
- **OQ-7**: Should we support server-side rendering (SSR) for wiki pages? Affects caching and SEO; may need ISR or static generation strategy.

## Implementation Status

> Last updated: 2026-02-25

### What's Implemented
- CI pipeline (.github/workflows/ci.yml) with lint, type-check, test, build
- Vercel deployment configured (vercel.json)
- Custom domain configured via Terraform (Cloudflare DNS)
- maxDuration=300 set on generate route

### What's Not Yet Implemented
- Preview deployments for PRs
- Rate limiting on public API
- Sentry or error-tracking integration
- Neon-backed wiki storage (currently file-based .wikismith-cache/)

### Current Limitations
- Wiki storage uses file-based cache (.wikismith-cache/) instead of Neon PostgreSQL; not suitable for production at scale.

## 12. Milestones

### M1: CI Pipeline & Basic Deployment (1–2 days)

- FR-004, FR-005, FR-006, FR-007, FR-008 (CI: lint, type-check, test, build; GitHub Actions)
- FR-001, FR-002, FR-003 (Vercel deployment; production URL)
- NFR-004, NFR-006, NFR-007 (CI performance, secrets, monorepo)

**Deliverable**: Push to main triggers CI and deploys to Vercel; production URL is live.

### M2: Preview Deployments & Environment Config (1 day)

- FR-009, FR-010, FR-011 (preview deployments for PRs)
- FR-012, FR-013, FR-014, FR-015 (environment variables)

**Deliverable**: Every PR gets a preview URL; env vars configured in Vercel.

### M3: Long-Running Generation & Storage (2–3 days)

- FR-016, FR-017, FR-018, FR-019 (long-running generation strategy)
- FR-020, FR-021, FR-022, FR-023 (wiki storage backend)

**Deliverable**: Wiki generation completes within timeout; wikis stored in durable backend; retrievable on view.

### M4: Rate Limiting & Error Handling (1 day)

- FR-024, FR-025, FR-026, FR-027 (rate limiting)
- FR-028, FR-029, FR-030 (error handling, observability)

**Deliverable**: API rate limited; errors return proper status; optional Sentry or structured logging.

### M5: Documentation & Hardening (1 day)

- NFR-001, NFR-002, NFR-003, NFR-005 (zero local setup, deployment timing, reproducibility)
- Deployment documentation

**Deliverable**: Evaluators can use the app with zero setup; deployment docs complete; ADR for storage and timeout strategy.
