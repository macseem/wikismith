# Authentication & Authorization — PRD

## 1. Goal

Implement secure authentication and authorization for WikiSmith using WorkOS, enabling users to sign in (primarily via GitHub), access their public and private repositories, and manage their wikis with proper tenant isolation. The system must combine user identity with GitHub API access in a single flow—auth and repo access in one—while supporting public wiki sharing, rate limiting, and GDPR-compliant data handling.

## 2. Problem Statement

WikiSmith needs to support both public and private GitHub repositories. Without authentication:

- Users cannot generate wikis for private repos—we have no way to access them
- There is no concept of "my wikis" vs. "other users' wikis"—no tenant isolation
- We cannot control costs (OpenAI usage) or prevent abuse—no per-user rate limiting
- Users cannot manage their account or delete their data—GDPR compliance is impossible

A separate GitHub OAuth flow just for repo access would create friction: users would sign in with WorkOS, then separately connect GitHub. The elegant solution is **GitHub as the primary auth provider**: when a user signs in with GitHub via WorkOS, we receive both (a) a WorkOS session establishing identity and (b) a GitHub OAuth access token for API access—auth and repo access in one flow.

Key challenges: storing the GitHub token securely (encrypted at rest), handling token refresh, protecting API routes and pages with middleware, allowing public wiki viewing without auth, and designing a schema that supports future team/org features.

## 3. User Stories

- As a **user**, I want to sign in with my GitHub account so that I can generate wikis for my public and private repositories.
- As a **user**, I want a single sign-in flow that grants both access to WikiSmith and access to my GitHub repos, so that I don't have to connect GitHub separately.
- As a **user**, I want to see only my own wikis and repositories in my dashboard, so that my data is private and isolated from other users.
- As a **user**, I want to share a wiki link with a colleague who is not signed in, so that they can view the documentation without creating an account.
- As a **user**, I want to sign out and have my session invalidated, so that I can securely end my session on shared devices.
- As a **user**, I want to delete my account and all associated data, so that I can exercise my right to be forgotten (GDPR).
- As a **platform operator**, I want rate limiting per user for wiki generation, so that we can control OpenAI costs and prevent abuse.
- As a **WikiSmith developer**, I want middleware-based auth protection for API routes and pages, so that unauthorized access is consistently blocked.
- As a **WikiSmith developer**, I want a schema that can support team/organization features later, so that we don't need a disruptive migration.

## 4. Functional Requirements (with FR-xxx IDs)

### 4.1 Authentication Provider (WorkOS)

- **FR-001**: The system MUST use WorkOS as the authentication provider for user identity and session management.
- **FR-002**: The system MUST support GitHub as the primary (and initially only) social connection for sign-in.
- **FR-003**: The system MUST configure WorkOS to enable "Return GitHub OAuth tokens" so that the GitHub access token is included in the Authenticate with code API response.
- **FR-004**: The system MUST request GitHub OAuth scopes sufficient for private repo access: at minimum `repo` (or `public_repo` + `repo` for full access). Additional scopes (e.g., `read:user`, `user:email`) MUST be requested as needed for user profile.
- **FR-005**: The sign-in flow MUST redirect users to WorkOS AuthKit, then to the configured callback URL with an authorization code; the callback MUST exchange the code for user + tokens via `authenticateWithCode`.
- **FR-006**: The system MUST support optional `provider_scopes` query parameter on the authorization URL for dynamic scope requests (e.g., requesting `repo` only when user attempts to add a private repo).

### 4.2 GitHub Token Storage & Security

- **FR-007**: The system MUST store the GitHub access token (and refresh token when available) for each user after successful authentication.
- **FR-008**: GitHub tokens MUST be encrypted at rest in the database (Neon PostgreSQL); encryption key MUST be stored in environment variables, never in code.
- **FR-009**: GitHub tokens MUST NOT be logged, exposed in API responses, or included in client-side code.
- **FR-010**: The database schema MUST support: `userId` (WorkOS user ID), `githubAccessToken` (encrypted), `githubRefreshToken` (encrypted, nullable), `githubTokenExpiresAt` (nullable, for GitHub Apps), `updatedAt`.

### 4.3 Token Refresh Strategy

- **FR-011**: The system MUST implement a token refresh strategy for GitHub tokens: when a token is expired or invalid (401 from GitHub API), attempt refresh if a refresh token exists.
- **FR-012**: For GitHub OAuth Apps: WorkOS may not provide refresh tokens; the system MUST handle this by prompting re-authentication when the token expires. Document this limitation.
- **FR-013**: For GitHub Apps (if used): WorkOS returns refresh token and expiration; the system MUST refresh proactively before expiration (e.g., when `expiresAt` is within 24 hours).
- **FR-014**: WorkOS session tokens (access token, refresh token) MUST be refreshed using `authenticateWithRefreshToken` when the access token expires; session middleware MUST handle this transparently.

### 4.4 Session Management

- **FR-015**: User sessions MUST be managed via WorkOS session tokens (JWT or sealed session cookie).
- **FR-016**: The system MUST support sealed session cookies (recommended) or HTTP-only cookies containing a session identifier; session data MUST be validated on each request.
- **FR-017**: Session cookies MUST use: `HttpOnly`, `Secure` (in production), `SameSite=Lax` (or `Strict` where appropriate).
- **FR-018**: The system MUST support sign-out: invalidate the session (clear cookie, optionally revoke via WorkOS `revokeSession` if session ID is tracked).
- **FR-019**: Session duration MUST be configurable (e.g., 7 days, 30 days); default SHOULD align with WorkOS recommendations.

### 4.5 Authorization & Tenant Isolation

- **FR-020**: Users MUST only access wikis and repositories that they own or have been explicitly granted access to (tenant isolation).
- **FR-021**: All API routes that perform user-specific operations (create wiki, list my wikis, delete wiki) MUST verify the authenticated user and enforce tenant isolation.
- **FR-022**: The data model MUST associate each wiki with a `userId` (WorkOS user ID); queries MUST filter by `userId` unless the resource is explicitly shared/public.
- **FR-023**: The schema MUST support future `organizationId` or `teamId` for team/org features; `userId` remains the primary owner for MVP.

### 4.6 Middleware-Based Auth Protection

- **FR-024**: The system MUST use Next.js middleware to protect routes: redirect unauthenticated users from protected pages to sign-in.
- **FR-025**: Protected routes MUST include: dashboard, "my wikis", settings, account, and any API route that performs user-specific mutations.
- **FR-026**: Public routes MUST include: landing page, sign-in, callback, and public wiki view (see FR-027).
- **FR-027**: Public wiki pages (e.g., `/wiki/[owner]/[repo]/[...slug]`) MUST be accessible without authentication when the wiki is marked as publicly shareable.

### 4.7 Public Wiki Sharing

- **FR-028**: Users MUST be able to mark a wiki as "public" or "shareable" so that anyone with the link can view it without signing in.
- **FR-029**: Public wiki URLs MUST be unguessable or use a share token (e.g., UUID) to prevent enumeration; alternatively, require explicit opt-in per wiki.
- **FR-030**: Public wiki pages MUST NOT expose user identity, GitHub tokens, or other sensitive data; only the rendered wiki content is visible.

### 4.8 Rate Limiting

- **FR-031**: The system MUST implement rate limiting per user for wiki generation (e.g., N generations per user per day or per hour).
- **FR-032**: Rate limits MUST be configurable via environment variables or database; default SHOULD be conservative (e.g., 5 generations per day per user for MVP).
- **FR-033**: When rate limited, the API MUST return HTTP 429 with a `Retry-After` header; the UI MUST display a clear message (e.g., "You've reached your daily limit. Try again tomorrow.").
- **FR-034**: Rate limit state MUST be stored in a durable backend (e.g., Neon, Vercel KV) keyed by `userId`; MUST survive serverless cold starts.

### 4.9 Account Deletion (GDPR)

- **FR-035**: Users MUST be able to request account deletion from a dedicated settings/account page.
- **FR-036**: Account deletion MUST remove: user record, GitHub tokens, all wikis owned by the user, and any cached or derived data.
- **FR-037**: Account deletion MUST be confirmed (e.g., modal with "Type DELETE to confirm") to prevent accidental deletion.
- **FR-038**: The system MUST support optional soft delete (mark as deleted, purge after retention period) or hard delete; document the choice in an ADR.
- **FR-039**: After deletion, the user MUST be signed out and redirected to the landing page; WorkOS user MAY be deleted via API if supported.

### 4.10 Error Handling

- **FR-040**: Authentication failures (invalid code, expired token, WorkOS API error) MUST return clear, user-friendly error messages.
- **FR-041**: When GitHub token is invalid or revoked, the system MUST prompt the user to re-authenticate (redirect to sign-in with appropriate message).
- **FR-042**: The callback handler MUST validate `state` parameter to prevent CSRF; reject requests with missing or invalid `state`.

## 5. Non-Functional Requirements (with NFR-xxx IDs)

- **NFR-001**: All secrets (WorkOS API key, client secret, encryption key, GitHub tokens) MUST be stored in environment variables or a secrets manager; never in source code or logs.
- **NFR-002**: The auth middleware MUST add minimal latency (< 50ms p95) to protected route requests.
- **NFR-003**: Token encryption/decryption MUST use a standard algorithm (e.g., AES-256-GCM); key rotation strategy MUST be documented.
- **NFR-004**: The auth implementation MUST be testable with mocked WorkOS and GitHub API responses; no real API calls in unit tests.
- **NFR-005**: Session validation MUST not require a round-trip to WorkOS on every request when using JWT or sealed cookies; verify locally where possible.
- **NFR-006**: The system MUST comply with OWASP authentication best practices: secure cookie flags, CSRF protection, no sensitive data in URLs.

## 6. UI/UX Requirements

- **UI-001**: Sign-in MUST be initiated via a prominent "Sign in with GitHub" button on the landing page and in the header when unauthenticated.
- **UI-002**: The sign-in button MUST clearly indicate GitHub (e.g., GitHub icon, "Continue with GitHub" text).
- **UI-003**: After sign-in, the user MUST be redirected to the dashboard or the page they were trying to access (redirect URL preservation).
- **UI-004**: Authenticated users MUST see a user avatar/menu in the header with options: Dashboard, Settings, Sign out.
- **UI-005**: Sign-out MUST be a single click with immediate effect; redirect to landing page.
- **UI-006**: Account deletion MUST be in a dedicated "Danger zone" or "Account" section in settings, with clear warnings.
- **UI-007**: Rate limit exceeded MUST display an inline message with the limit and when it resets (e.g., "5/5 generations used today. Resets at midnight UTC.").
- **UI-008**: Public wiki pages MUST have minimal chrome (no sign-in prompt, optional "Sign in to create your own wiki" CTA).
- **UI-009**: Loading states during auth redirect/callback MUST show a spinner or skeleton; avoid blank screen.

## 7. Technical Considerations

### 7.1 WorkOS Integration

- **SDK**: Use `@workos-inc/node` for server-side WorkOS API calls.
- **Auth flow**: `getAuthorizationUrl` → redirect user → `authenticateWithCode` in callback.
- **GitHub token**: Enable "Return GitHub OAuth tokens" in WorkOS Dashboard (GitHub OAuth config). Request scopes: `repo`, `read:user`, `user:email` (or `public_repo` + `repo` as needed).
- **Session**: Prefer `@workos-inc/authkit-nextjs` or `authkit-session` for Next.js integration; sealed session cookies with `cookiePassword` from env.

### 7.2 Database Schema (Neon)

```ts
// users table (extend as needed)
interface IUser {
  id: string;                    // WorkOS user ID (primary key)
  email: string;
  createdAt: string;
  updatedAt: string;
}

// user_github_tokens table (encrypted)
interface IUserGitHubToken {
  userId: string;                 // FK to users
  githubAccessToken: string;      // encrypted
  githubRefreshToken: string | null;  // encrypted, nullable
  githubTokenExpiresAt: string | null; // ISO timestamp, for GitHub Apps
  updatedAt: string;
}

// wikis table (simplified)
interface IWiki {
  id: string;
  userId: string;                 // owner
  organizationId: string | null;  // future: team/org
  repoOwner: string;
  repoName: string;
  isPublic: boolean;              // shareable without auth
  shareToken: string | null;      // optional: UUID for share links
  createdAt: string;
  updatedAt: string;
}
```

### 7.3 Token Encryption

- Use `crypto.createCipheriv` / `createDecipheriv` with AES-256-GCM, or a library like `@47ng/cloak` or `fernet` for encrypt/decrypt.
- Key: 32-byte key from `GITHUB_TOKEN_ENCRYPTION_KEY` env var (base64 or hex).
- Store encrypted blob in DB; decrypt only when making GitHub API calls.

### 7.4 Next.js Middleware

```ts
// middleware.ts
// Match protected routes: /dashboard, /settings, /api/wikis/* (mutations)
// Allow: /, /sign-in, /callback, /wiki/[owner]/[repo]/[...slug] (if public)
// Redirect unauthenticated to /sign-in?redirect=/original-path
```

### 7.5 Public Wiki Access

- For `/wiki/[owner]/[repo]/[...slug]`: lookup wiki by `owner/repo` or `shareToken`.
- If `isPublic` or valid share token: render without auth.
- If private and no auth: redirect to sign-in or show 404 (don't reveal existence).

### 7.6 Rate Limiting Implementation

- Key: `rate_limit:wiki_generation:{userId}`
- Increment on generation request; check before starting. Use sliding window or fixed window.
- Backend: Upstash Redis, Vercel KV, or PostgreSQL with `rate_limit` table.

## 8. Dependencies

- **WorkOS**: Requires WorkOS account, API key, Client ID, Client Secret. AuthKit must be enabled; GitHub connection configured with "Return GitHub OAuth tokens" and `repo` scope.
- **Neon PostgreSQL**: User table, `user_github_tokens` table, `wikis` table. Encryption key in env.
- **Next.js 15**: Middleware, API routes, App Router. Compatible with WorkOS AuthKit Next.js SDK if available.
- **Repository Ingestion PRD**: Ingestion must accept a GitHub token for private repo access; currently assumes public or `GITHUB_TOKEN` env. Must be updated to use user's token when authenticated.
- **Deployment PRD**: Environment variables for WorkOS, encryption key must be configured in Vercel.

## 9. Success Metrics

- **SM-1**: 95% of sign-in attempts (GitHub) complete successfully within 10 seconds.
- **SM-2**: Zero production incidents from leaked tokens (GitHub or WorkOS) in logs or client.
- **SM-3**: 100% of protected API routes reject unauthenticated requests with 401.
- **SM-4**: 100% of user-specific queries enforce tenant isolation (no cross-user data leakage).
- **SM-5**: Public wiki pages load without auth in < 2s p95.
- **SM-6**: Account deletion removes all user data within 24 hours (or immediately for hard delete).
- **SM-7**: Rate limiting correctly blocks users who exceed the limit; no false positives for legitimate users.

## 10. Out of Scope

- **Additional social providers (Google, Microsoft)**: GitHub only for MVP; schema supports adding later.
- **SSO / Enterprise**: WorkOS supports SSO; not in scope for MVP. Design should not preclude adding SSO later.
- **Team/Organization features**: Schema supports `organizationId`; implementation of team wikis, org-level rate limits, or RBAC is future work.
- **Multi-factor authentication (MFA)**: Delegated to WorkOS; no custom MFA in WikiSmith for MVP.
- **OAuth for third-party apps**: WorkOS Connect (allowing other apps to use WikiSmith as IdP) is not in scope.
- **Granular wiki sharing**: No "share with specific user" or "invite collaborator" for MVP; only public/private per wiki.
- **Session management UI**: No "View active sessions" or "Revoke other devices" for MVP; can use WorkOS Dashboard.

## 11. Open Questions

- **OQ-1**: Does WorkOS return a refresh token for GitHub OAuth Apps? If not, what is the token lifetime, and how often will users need to re-authenticate?
- **OQ-2**: GitHub App vs. OAuth App for GitHub connection—GitHub Apps provide refresh tokens and finer permissions. Should we use a GitHub App from day one?
- **OQ-3**: Encryption key rotation—how do we rotate the key without invalidating all stored tokens? Consider per-token IV and key versioning.
- **OQ-4**: Public wiki URL structure—use `owner/repo` (guessable) or `shareToken` (UUID) in path? Trade-off: readability vs. enumeration.
- **OQ-5**: Rate limit backend—Neon vs. Vercel KV vs. Upstash Redis? Affects cost and serverless compatibility.
- **OQ-6**: Should we support "Sign in with email" (magic link or password) for users without GitHub? WorkOS supports it; adds complexity.
- **OQ-7**: WorkOS session revocation—do we need to track session IDs to revoke on sign-out, or is clearing the cookie sufficient?

## Implementation Status

> Last updated: 2026-02-25

### What's Implemented
- WorkOS env vars configured
- DB schema for users table exists

### What's Not Yet Implemented
- Sign in/out flow
- Middleware auth protection
- GitHub token storage
- Session management
- All other auth features described in this PRD

### Current Limitations
- No authentication; app operates in unauthenticated mode only. Private repos not accessible.

## 12. Milestones

### M1: WorkOS Integration & Sign-In (3–4 days)

- FR-001, FR-002, FR-003, FR-004, FR-005 (WorkOS + GitHub auth flow)
- FR-015, FR-016, FR-017, FR-018, FR-019 (session management)
- FR-040, FR-041, FR-042 (error handling, state validation)
- NFR-001, NFR-004, NFR-006 (secrets, testability, OWASP)
- UI-001, UI-002, UI-003, UI-004, UI-005, UI-009

**Deliverable**: User can sign in with GitHub; session cookie set; redirect to dashboard. Sign-out works.

### M2: GitHub Token Storage & Ingestion Integration (2–3 days)

- FR-007, FR-008, FR-009, FR-010 (token storage, encryption)
- FR-011, FR-012, FR-013, FR-014 (token refresh strategy)
- Database schema: `users`, `user_github_tokens`
- Integration: Pass user's GitHub token to ingestion when generating wiki for private repo

**Deliverable**: GitHub token stored encrypted; ingestion uses it for private repo fetch. Token refresh handled (or re-auth prompted).

### M3: Authorization & Middleware (2–3 days)

- FR-020, FR-021, FR-022, FR-023 (tenant isolation, schema)
- FR-024, FR-025, FR-026 (middleware protection)
- FR-027, FR-028, FR-029, FR-030 (public wiki sharing)
- NFR-002, NFR-005 (middleware performance, local validation)

**Deliverable**: Protected routes require auth; public wikis viewable without auth; tenant isolation enforced.

### M4: Rate Limiting & Account Deletion (2 days)

- FR-031, FR-032, FR-033, FR-034 (rate limiting)
- FR-035, FR-036, FR-037, FR-038, FR-039 (account deletion)
- UI-006, UI-007, UI-008

**Deliverable**: Rate limit enforced per user; account deletion removes all data. UI for both.

### M5: Polish & Hardening (1–2 days)

- NFR-003 (encryption algorithm, key rotation doc)
- ADR for: encryption strategy, public wiki URL structure, rate limit backend
- E2E tests: sign-in flow, protected route redirect, public wiki access, account deletion
- Documentation: `docs/auth.md` with setup instructions

**Deliverable**: Production-ready auth; documented; tested.
