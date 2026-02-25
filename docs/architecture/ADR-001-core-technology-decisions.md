# ADR-001: Core Technology Decisions

## Status
Accepted

## Context

WikiSmith is an AI-powered wiki generator for GitHub repositories. We need to make foundational decisions on auth, storage, and generation UX that affect every other feature. The project is a monorepo built on TypeScript with Next.js 15.

## Decisions

### 1. Auth + Private Repo Access: WorkOS with GitHub OAuth

**Decision**: Use WorkOS as the auth provider with GitHub as the social connection.

**Why**: GitHub OAuth via WorkOS solves two problems in one flow — user identity AND a GitHub access token that can access private repos (`repo` scope). No separate "connect GitHub" flow needed.

**Consequences**:
- WorkOS handles token refresh, session management, GDPR deletion
- GitHub access token stored AES-256-GCM encrypted in Neon, decrypted only at use time
- Re-auth required if token expires or lacks required scopes
- WorkOS cost is a dependency; GitHub App would be free but more complex

**Alternatives considered**:
| Alternative | Why rejected |
|-------------|-------------|
| NextAuth.js + GitHub | Less control over token scopes; more custom code |
| GitHub App | More robust webhooks, but separate OAuth flow needed for user auth |
| Custom JWT | Reinventing the wheel; security risk |

---

### 2. Database: Neon PostgreSQL + pgvector

**Decision**: Neon as the primary database with the pgvector extension.

**Why**: Relational data (users, repos, wiki versions) needs SQL. pgvector enables RAG for Q&A and semantic search. Single database = simpler ops, atomic transactions when regenerating wikis (delete old embeddings + insert new in one tx).

**Schema highlights**:
- `users` — WorkOS identity, encrypted GitHub token
- `repositories` — tracked repos, branch, webhook config
- `wiki_versions` — commit-pinned, generation status
- `wiki_pages` — content, feature hierarchy
- `wiki_embeddings` — `vector(1536)` with HNSW index
- `generation_jobs` — async job tracking

**ORM**: Drizzle ORM + Drizzle Kit. Type-safe queries, migrations, works with Neon serverless driver.

**Consequences**:
- Neon serverless driver (`@neondatabase/serverless`) needed for Vercel compatibility
- HNSW index on embeddings is eventually consistent (not ACID for vector ops)
- Neon free tier has limits; production needs paid plan

**Alternatives considered**:
| Alternative | Why rejected |
|-------------|-------------|
| Vercel KV | Key-value only; no vector search; can't join with user data |
| Pinecone + Postgres | Two separate services; split context; more complexity |
| Supabase | pgvector support but less control; not Neon |

---

### 3. Wiki Generation UX: Real-Time Streaming

**Decision**: Stream wiki pages to the client as they're generated via Server-Sent Events (SSE).

**Why**: Generation takes minutes. A blank loading spinner for that long is unusable. Streaming lets users see the wiki forming in real-time — early pages are readable while later ones are still generating. Partial wikis are still valuable.

**Implementation**:
- SSE endpoint: `GET /api/generate/[owner]/[repo]/stream`
- Events: `feature_classified`, `page_generated`, `generation_complete`, `generation_error`
- Client renders pages incrementally as events arrive
- On error: partial wiki remains, failed features listed

**Consequences**:
- SSE requires persistent connection; Vercel serverless may timeout for large repos
- If timeout hit: move to Inngest for job orchestration (out-of-band with polling)
- Client must handle partial state and reconnection

**Alternatives considered**:
| Alternative | Why rejected |
|-------------|-------------|
| Synchronous wait | 10-minute spinner is unusable UX |
| Submit + poll | Better than sync but less real-time; polling adds latency |
| WebSocket | Overkill; SSE is simpler and sufficient for one-way streaming |

---

### 4. Long-Running Jobs: Vercel Serverless First, Inngest as Fallback

**Decision**: Start with Vercel Serverless Pro (5-min timeout, `maxDuration: 300`). Add Inngest only if repos consistently exceed that limit.

**Why**: Optimizing for simplicity at MVP. Inngest adds a real dependency, webhook complexity, and debugging overhead. Most repos should complete in under 5 minutes.

**Trigger for escalation**: If >20% of wiki generation jobs fail due to timeout, integrate Inngest.

**Consequences**:
- Vercel Pro plan required (not Hobby)
- Large repos (100k+ files) may still timeout; acceptable for MVP

---

### 5. Commit-Pinned Wikis with GitHub Webhooks

**Decision**: Every wiki version is tied to a specific commit SHA. Push events on the tracked branch trigger automatic regeneration via GitHub webhooks.

**Implementation**:
- Register webhook on repo: `POST /api/github/repos/{owner}/{repo}/hooks`
- Verify all incoming webhooks with `X-Hub-Signature-256` (HMAC-SHA256)
- Webhook secret per repo, stored in `repositories.webhook_secret`
- Job deduplication by `owner/repo/branch` to handle rapid pushes

**URL structure**:
- `/wiki/[owner]/[repo]` — latest version
- `/wiki/[owner]/[repo]/[commitSha]` — specific version

**Consequences**:
- Webhook registration requires user's GitHub token with `write:repo_hook` scope
- Vercel endpoint must be publicly reachable (satisfied by deployment)
- Need to handle webhook delivery retries (GitHub retries on failure)

**Alternatives considered**:
| Alternative | Why rejected |
|-------------|-------------|
| Polling | Adds latency; wastes API quota |
| GitHub App | Better webhook management but requires app installation per repo |

---

## Related PRDs

- `features/authentication-authorization-prd.md`
- `features/database-embeddings-prd.md`
- `features/wiki-versioning-auto-update-prd.md`
- `features/wiki-content-generation-prd.md`
- `features/deployment-infrastructure-prd.md`
