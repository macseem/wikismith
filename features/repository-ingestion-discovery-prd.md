# Repository Ingestion & Discovery — PRD

## 1. Goal

Enable WikiSmith to accept a GitHub repository URL (public or private), fetch its content using appropriate credentials, discover and extract relevant files, and produce a structured representation ready for the analysis engine — forming the first stage of the wiki generation pipeline.

## 2. Problem Statement

Before WikiSmith can analyze a codebase and generate documentation, it must obtain the repository's content in a usable form. Users provide a GitHub URL; the system must reliably fetch the repo, handle repos of varying sizes and structures, extract the right data (source files, manifests, README), and output a format the analyzer expects. Without a robust ingestion layer, the entire pipeline fails. Key challenges include GitHub rate limits, large repos, binary files, and ensuring deterministic, cacheable results.

## 3. User Stories

- As a **user**, I want to paste a GitHub repo URL and have the system fetch it so that I can generate a wiki without manual setup.
- As a **user**, I want the system to work for both small CLI tools and large frameworks so that I can document any public project.
- As a **user**, I want to see clear feedback when a repo is invalid, private, or too large so that I understand why ingestion failed.
- As a **user**, I want the system to remember recently processed repos so that re-generating a wiki for the same repo is fast.
- As a **developer**, I want a well-defined output schema from ingestion so that the analyzer can consume it without coupling to fetch logic.
- As a **developer**, I want ingestion to be testable in isolation so that we can mock GitHub and validate behavior.

## 4. Functional Requirements (with FR-xxx IDs)

### 4.1 URL Parsing & Validation

- **FR-001**: Accept GitHub repository URLs in formats: `https://github.com/owner/repo`, `https://github.com/owner/repo/`, `https://github.com/owner/repo.git`, and `owner/repo`.
- **FR-002**: Parse and extract `owner` and `repo` from the URL; reject non-GitHub URLs with a clear error.
- **FR-003**: Support optional ref (branch, tag, or commit SHA) via URL fragment or query param (e.g. `?ref=main` or `#v1.0.0`); default to repository default branch when omitted.
- **FR-004**: Validate that the repository exists before proceeding; return specific errors for 404 or access denied.
- **FR-004a**: For private repos, use the user's GitHub OAuth token (obtained via WorkOS) to authenticate requests. If no token is available or the token lacks access, return a clear error prompting re-authentication.
- **FR-004b**: For public repos, authentication is optional but recommended for higher rate limits.

### 4.2 Repository Fetching

- **FR-005**: Fetch repository content using one of: GitHub archive (zip/tarball), GitHub API (Contents API), or shallow git clone — with a documented strategy and fallback.
- **FR-006**: Resolve the target ref (branch/tag/commit) to a concrete commit SHA before fetching; use this SHA as the canonical identifier for caching and output.
- **FR-007**: Use the user's GitHub OAuth token (from WorkOS authentication) for authenticated requests; this enables both higher rate limits (5000 req/hr) AND access to private repositories the user has permissions for. Fall back to unauthenticated requests for public repos when no token is available.
- **FR-007a**: Validate token scopes before fetching — private repos require `repo` scope. If scope is insufficient, return an error guiding the user to re-authorize via WorkOS.
- **FR-008**: Handle rate limit responses (403/429); implement exponential backoff and surface a user-friendly "rate limited, try again later" message.

### 4.3 File Discovery & Extraction

- **FR-009**: Produce a complete file tree (paths relative to repo root) for all tracked files at the resolved commit.
- **FR-010**: Extract and include file contents for text-based files; exclude binary files by default (configurable allowlist for specific extensions if needed).
- **FR-011**: Detect and extract README files (README, README.md, README.txt, etc.) from repo root; include content and path.
- **FR-012**: Detect and extract package manifests: `package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, `requirements.txt`, `Gemfile`, etc.; include content and path.
- **FR-013**: Compute a language breakdown (file count and/or line count per language) using extension-based or content-based detection.
- **FR-014**: Apply configurable ignore patterns (e.g. `.gitignore`-style) to skip `node_modules`, `dist`, `.git`, and similar; support a default ignore list.
- **FR-015**: Enforce a maximum file size for content extraction (e.g. 1MB per file); for larger files, include path and metadata but not content.
- **FR-016**: Enforce a maximum total file count or total size for the repo; reject or truncate with clear messaging when exceeded.

### 4.4 Output Schema

- **FR-017**: Output a structured representation (JSON or in-memory object) containing: `repo` (owner, name, defaultBranch), `ref` (branch/tag/SHA), `commitSha`, `fileTree`, `files` (path → content map for extracted files), `readme`, `manifests`, `languageBreakdown`, `metadata` (fetch timestamp, strategy used).
- **FR-018**: Ensure the output schema is versioned and documented so the analyzer can depend on it.

### 4.5 Caching

- **FR-019**: Cache ingestion results keyed by `owner/repo` + `commitSha`; if a cache hit exists, return cached output without re-fetching.
- **FR-020**: Support configurable cache TTL and cache invalidation (e.g. force refresh flag).
- **FR-021**: Store cache in Neon PostgreSQL (primary storage backend); cache entries linked to repo and commit SHA in the `wiki_versions` table.

### 4.6 Error Handling

- **FR-022**: Return structured errors for: invalid URL, repo not found, repo private, rate limited, ref not found, repo too large, fetch timeout.
- **FR-023**: Include actionable messages (e.g. "Repository is private. WikiSmith MVP supports only public repos.").

## 5. Non-Functional Requirements (with NFR-xxx IDs)

- **NFR-001**: Ingestion of a typical medium repo (e.g. 500 files, 50K LOC) completes within 60 seconds under normal conditions.
- **NFR-002**: Support repos up to ~10K files or ~100MB extracted content; define and enforce hard limits.
- **NFR-003**: Use authenticated GitHub requests when `GITHUB_TOKEN` or equivalent is configured to avoid 60 req/hr unauthenticated limit.
- **NFR-004**: Idempotent for same `owner/repo` + `commitSha`; repeated calls return identical output.
- **NFR-005**: No secrets (tokens, keys) in logs or error messages.
- **NFR-006**: Ingestion logic is stateless except for cache; suitable for serverless (Vercel) execution.

## 6. UI/UX Requirements

- **UR-001**: Input field accepts GitHub URL with placeholder: `https://github.com/owner/repo` or `owner/repo`.
- **UR-002**: Optional ref input (branch/tag/commit) with helper text: "Leave empty for default branch."
- **UR-003**: Loading state during ingestion: spinner or progress indicator with message "Fetching repository..."
- **UR-004**: Success: transition to next step (analysis) or show summary (e.g. "Found 342 files, 12 languages").
- **UR-005**: Error states: display specific messages for invalid URL, not found, private, rate limited, too large.
- **UR-006**: Cache hit: optionally show "Using cached data" or skip loading state when instant.

## 7. Technical Considerations

### 7.1 Fetch Strategy Comparison

| Strategy | Pros | Cons |
|----------|------|------|
| **Archive (zip/tarball)** | Single HTTP request, no git binary, includes full tree | No sparse checkout, downloads everything; LFS objects not in archive by default |
| **GitHub Contents API** | Per-file/dir, can be sparse | Many API calls for large repos; 60/hr unauthenticated, 5K/hr authenticated |
| **Shallow git clone** | Full git semantics, sparse checkout possible | Requires `git` binary, more complex in serverless |

**Recommendation**: Prefer **archive download** for MVP — one request per repo, works without git, sufficient for public repos. Add authentication for higher rate limits. Consider Contents API or clone for future optimizations (e.g. sparse fetch for monorepos).

### 7.2 Archive Endpoints

- Tarball: `GET https://api.github.com/repos/{owner}/{repo}/tarball/{ref}` → 302 to `codeload.github.com`
- Zipball: `GET https://api.github.com/repos/{owner}/{repo}/zipball/{ref}` → 302 to `codeload.github.com`
- Ref can be branch name, tag, or commit SHA.

### 7.3 Rate Limits (GitHub REST API)

- Unauthenticated: 60 requests/hour per IP.
- Authenticated (PAT): 5,000 requests/hour.
- Archive download counts as 1 request; strongly recommend `GITHUB_TOKEN` for production.

### 7.4 File Size & Repo Limits

- GitHub recommends repos under 10GB; single file max 100MB.
- For ingestion: cap per-file content at ~1MB; cap total extracted size (e.g. 100MB) to avoid memory issues in serverless.
- Define max file count (e.g. 10,000) to bound processing time.

### 7.5 Binary Detection

- Use magic bytes or extension list (e.g. `.png`, `.jpg`, `.pdf`, `.woff2`) to skip binary files.
- Include path in file tree but omit content.

### 7.6 Output Contract

The analyzer package will consume an interface such as:

```ts
interface IIngestionResult {
  repo: { owner: string; name: string; defaultBranch: string };
  ref: string;
  commitSha: string;
  fileTree: string[];
  files: Record<string, string>;
  readme: { path: string; content: string } | null;
  manifests: Array<{ path: string; content: string }>;
  languageBreakdown: Record<string, { files: number; lines?: number }>;
  metadata: { fetchedAt: string; strategy: string };
}
```

Define this in `@wikismith/shared` and implement in the ingestion package.

## 8. Dependencies

- **GitHub API access**: No external service beyond GitHub; requires network.
- **Authentication**: User's GitHub OAuth token from WorkOS for private repos and higher rate limits. See `authentication-authorization-prd.md`.
- **Cache backend**: Neon PostgreSQL — wiki versions and ingestion results stored durably. See `database-embeddings-prd.md`.
- **Package structure**: New package `@wikismith/ingestion` or logic in `apps/web`; recommend dedicated package for testability.
- **Shared types**: `@wikismith/shared` must define `IIngestionResult` and related types before analyzer integration.

## 9. Success Metrics

- **SM-1**: 95% of valid public repo URLs (owner/repo format) successfully produce an `IIngestionResult` within 60s.
- **SM-2**: Cache hit returns result in &lt;2s for previously processed repos.
- **SM-3**: Zero production incidents from leaked tokens or secrets in logs.
- **SM-4**: Clear error messages for 100% of failure modes (invalid URL, 404, private, rate limit, too large).
- **SM-5**: Analyzer can consume `IIngestionResult` without modification to ingestion package.

## 10. Out of Scope

- **GitHub Enterprise / self-hosted**: GitHub.com only.
- **GitLab, Bitbucket, or other hosts**: GitHub only for MVP.
- **Submodules**: Do not recursively fetch submodules.
- **Git LFS content**: Archives exclude LFS objects by default; not in scope for MVP.
- **Incremental / delta ingestion**: Full fetch only; no diff from previous run.
- **User-provided local paths**: URL input only.
- **Real-time progress streaming**: Simple loading state; no granular progress events.

## 11. Open Questions

- **OQ-1**: Where should ingestion live — new `packages/ingestion` or inside `apps/web`? Recommendation: dedicated package for reuse and testing.
- **OQ-2**: Cache backend for Vercel — Vercel KV, file system (ephemeral), or external Redis? Affects cache persistence across cold starts.
- **OQ-3**: Default ignore patterns — use `.gitignore` from repo when present, or always apply a fixed list?
- **OQ-4**: Should we support `?ref=HEAD` or only explicit branch/tag/SHA for reproducibility?
- **OQ-5**: Max repo size limits — 10K files and 100MB extracted content as initial values; confirm with real-world repos.

## Implementation Status

> Last updated: 2026-02-25

### What's Implemented
- URL parsing for all formats: github.com/owner/repo, owner/repo, .git suffix, with optional ref
- Archive (tarball) fetch strategy via GitHub API
- Commit SHA resolution, rate limit handling, error handling
- File extraction: tarball extraction with binary detection, ignore patterns, size limits
- README and manifest detection, language breakdown computation
- Output schema (`IIngestionResult`) defined in @wikismith/shared and implemented
- File-based cache in .wikismith-cache/
- Structured errors for all failure modes (IngestionError class)

### What's Not Yet Implemented
- GitHub OAuth token for private repos (auth not done yet)
- DB-backed caching (Neon PostgreSQL as specified in PRD)

### Current Limitations
- Caching uses local file system (.wikismith-cache/) instead of Neon PostgreSQL; cache does not persist across serverless cold starts or different deployment instances.

## 12. Milestones

### M1: URL Parsing & Validation (1–2 days)

- Implement URL parser for GitHub formats.
- Validate repo exists and is public via GitHub API.
- Support optional ref; resolve to commit SHA.
- Unit tests with mocked GitHub API.

### M2: Archive Fetch & Extract (2–3 days)

- Implement archive download (tarball or zip) with auth support.
- Extract archive to in-memory or temp file structure.
- Build file tree and file content map.
- Apply ignore patterns and binary exclusion.
- Enforce per-file and total size limits.

### M3: README & Manifest Extraction (1 day)

- Detect README files; extract content.
- Detect package manifests; extract content.
- Compute language breakdown (extension-based).

### M4: Output Schema & Integration (1 day)

- Define `IIngestionResult` in `@wikismith/shared`.
- Produce output matching schema.
- Integration test: fetch real repo, validate output shape.

### M5: Caching (1–2 days)

- Design cache key: `owner/repo` + `commitSha`.
- Implement cache layer (backend TBD).
- Add force-refresh option.
- Verify cache hit path.

### M6: Error Handling & UX (1 day)

- Structured error types for all failure modes.
- Map errors to user-facing messages.
- Wire loading/error states in UI (if UI exists in parallel).
