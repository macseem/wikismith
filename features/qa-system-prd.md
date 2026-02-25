# Q&A System — PRD

## 1. Goal

Enable users to ask natural language questions about a repository's wiki and codebase and receive AI-powered answers with inline citations to source code—transforming the static wiki into an interactive, conversational knowledge base that accelerates developer onboarding and code exploration.

## 2. Problem Statement

A generated wiki provides structured documentation, but developers often have specific questions: "How does authentication work?", "Where is the config loaded?", "What does the UserService do?" Browsing the wiki requires knowing where to look. Developers waste time scanning pages or using Ctrl+F across multiple documents. The wiki is read-only and passive—it does not respond to intent.

The Q&A system solves this by letting users ask questions in natural language. The AI uses the wiki content and analysis data as context to produce targeted answers with citations. This "bonus" feature can be a strong differentiator: it turns WikiSmith from a documentation generator into an intelligent codebase assistant.

## 3. User Stories

- As a **developer exploring an unfamiliar repo**, I want to ask "How does authentication work?" and get a concise answer with links to the relevant code, so that I can understand the flow without reading every page.
- As a **developer**, I want to ask "Where is the config loaded?" and receive the file path(s) and a brief explanation, so that I can jump directly to the implementation.
- As a **developer**, I want to ask "What does the UserService do?" and get a summary of its purpose, public interface, and where it's used, so that I can decide if I need to read the full feature page.
- As a **developer**, I want answers to stream in progressively, so that I see content quickly instead of waiting for the full response.
- As a **developer**, I want every factual claim in an answer to link to the source code, so that I can verify and dive deeper.
- As a **developer**, I want to know when my question is outside the wiki's scope (e.g., "What's the weather?"), so that I understand the system's limitations.
- As a **repository maintainer**, I want the Q&A to be rate-limited, so that the system is not abused and costs remain predictable.
- As a **WikiSmith developer**, I want the Q&A to work for both small and large repos, so that we don't fail or truncate context for bigger codebases.

## 4. Functional Requirements (with FR-xxx IDs)

### 4.1 Question Input & Validation

- **FR-001**: The system MUST accept a natural language question as input (text string, max length configurable, e.g., 500 characters).
- **FR-002**: The system MUST validate that the question is non-empty and not purely whitespace before processing.
- **FR-003**: The system MUST support questions in English; other languages MAY be supported in future.
- **FR-004**: The system MUST associate each question with a specific wiki/repository context (owner, repo, commit SHA or wiki version).

### 4.2 Context Retrieval

- **FR-005**: The system MUST use wiki content (generated markdown pages) as the primary context for answering questions.
- **FR-006**: The system MAY use analysis data (signatures, import graph, file metadata) as supplementary context when relevant.
- **FR-007**: For small/medium repos (e.g., wiki content < 50K tokens), the system MAY include the full wiki content as context in a single request.
- **FR-008**: For large repos (wiki content exceeds model context limit), the system MUST use a retrieval strategy (RAG): embed wiki chunks, retrieve top-k relevant chunks by semantic similarity, and pass only those to the AI.
- **FR-009**: Retrieved chunks MUST include sufficient context (e.g., feature name, section headers) so the AI can cite accurately.
- **FR-010**: The system MUST support a configurable retrieval strategy: full context (small repos) or RAG (large repos), with automatic selection based on wiki size.

### 4.3 Answer Generation

- **FR-011**: The system MUST generate answers using OpenAI (gpt-5-mini or equivalent) or a configurable model.
- **FR-012**: Answers MUST be in markdown format with proper structure (paragraphs, lists, code blocks where appropriate).
- **FR-013**: The system MUST support streaming responses (Server-Sent Events or equivalent) for progressive display.
- **FR-014**: The system MUST include citations in answers: every factual claim about code MUST link to the specific source location (file path, line numbers).
- **FR-015**: Citation format MUST be GitHub blob URLs: `https://github.com/{owner}/{repo}/blob/{branch}/{path}#L{start}-L{end}` (or `#L{line}` for single line).
- **FR-016**: Citations MUST reference the correct branch (default branch from repo metadata) and valid file paths from the analysis.
- **FR-017**: The AI prompt MUST instruct the model to cite sources and to say "I don't know" or "This is outside the scope of the wiki" when the question cannot be answered from the available context.
- **FR-018**: The system MUST handle out-of-scope questions gracefully: return a polite message indicating the question is outside the wiki's scope, without attempting to hallucinate an answer.

### 4.4 Chat vs. Single-Turn

- **FR-019**: The system MUST support at least single-turn Q&A: one question → one answer. No conversation history required for MVP.
- **FR-020**: The system MAY support multi-turn conversation (follow-up questions with context) as a future enhancement; document in Out of Scope if deferred.

### 4.5 Rate Limiting & Abuse Prevention

- **FR-021**: The system MUST enforce rate limiting per user/session (e.g., 10 questions per minute, 100 per hour per wiki).
- **FR-022**: Rate limit configuration MUST be configurable (env vars or config).
- **FR-023**: When rate limited, the system MUST return a clear error (HTTP 429 or equivalent) with a "retry after" message.
- **FR-024**: The system MUST NOT process questions that exceed the input length limit; return validation error.

### 4.6 Error Handling

- **FR-025**: The system MUST handle AI API errors (timeout, rate limit, invalid response) with retry logic (configurable max retries) and surface a user-friendly error message.
- **FR-026**: The system MUST handle missing or incomplete wiki context: if no wiki exists for the repo, return a clear error (e.g., "Wiki not yet generated for this repository").
- **FR-027**: The system MUST NOT expose internal errors (stack traces, API keys) to the user.

### 4.7 Persistence (Optional for MVP)

- **FR-028**: The system MAY persist question-answer pairs for analytics, quality improvement, or caching; if so, user data handling MUST comply with privacy requirements.
- **FR-029**: For MVP, persistence of Q&A history is optional; stateless single-turn is acceptable.

## 5. Non-Functional Requirements (with NFR-xxx IDs)

- **NFR-001**: Answer generation (first token) SHOULD complete within 3 seconds p95 for single-turn with full context; within 5 seconds for RAG (retrieval + generation).
- **NFR-002**: Full answer streaming SHOULD complete within 30 seconds p95 for typical questions.
- **NFR-003**: The system MUST isolate AI calls behind a clean interface (e.g., `IQAService`) for testability and swapability.
- **NFR-004**: The system MUST be testable with mocked AI responses; no real API calls in unit tests.
- **NFR-005**: The system MUST NOT store or log sensitive data (API keys, user tokens); use environment variables for configuration.
- **NFR-006**: Token usage MUST be tracked and logged for cost monitoring (optional but recommended).
- **NFR-007**: The system MUST respect OpenAI rate limits; implement backoff for concurrent requests.
- **NFR-008**: For RAG: embedding and retrieval MUST complete within 2 seconds p95 for wikis with up to 500 chunks.
- **NFR-009**: The system MUST be suitable for serverless deployment (Vercel); avoid long-running or stateful operations that exceed function timeout.

## 6. UI/UX Requirements

- **UI-001**: The Q&A interface MUST be accessible from the wiki view—either a persistent search/ask bar, a dedicated Q&A page, or a chat panel.
- **UI-002**: The input MUST support multi-line text (textarea) for longer questions; placeholder: "Ask a question about this codebase..."
- **UI-003**: The system MUST display streaming responses progressively (typing effect or append-as-received).
- **UI-004**: Citations in answers MUST be visually distinguishable (e.g., inline link with icon, or "View source" badge) and MUST open in a new tab when clicked.
- **UI-005**: The interface MUST show a loading state while the answer is being generated (e.g., skeleton or spinner).
- **UI-006**: Error states (rate limit, API failure, out of scope) MUST display user-friendly messages with actionable guidance (e.g., "Try again in 60 seconds", "Generate the wiki first").
- **UI-007**: The interface MUST support dark mode (per project UI/UX rules).
- **UI-008**: The interface MUST be keyboard-accessible (e.g., Enter to submit, Escape to clear).
- **UI-009**: Empty state: when no question has been asked, show example questions (e.g., "How does authentication work?", "Where is the config loaded?").
- **UI-010**: For chat-like interface: messages MUST be clearly distinguished (user question vs. AI answer) with appropriate styling.

## 7. Technical Considerations

### 7.1 RAG vs. Full Context Strategy

| Strategy | When to Use | Pros | Cons |
|----------|-------------|------|------|
| **Full context** | Wiki < ~50K tokens | Simple, no embedding; full fidelity | Fails for large repos |
| **RAG** | Wiki > ~50K tokens | Scales to large repos; lower cost | May miss relevant chunks; retrieval quality critical |

**Recommendation**: Implement both. Auto-select based on wiki token count. Threshold configurable (e.g., 40K tokens).

### 7.2 RAG Implementation (when used)

- **Embedding model**: OpenAI `text-embedding-3-small` (1536 dimensions). Chunk wiki pages into sections (by `##` or `###` headers); each chunk = one embeddable unit.
- **Chunk size**: 500–1000 tokens per chunk with overlap (e.g., 100 tokens) to preserve context at boundaries.
- **Retrieval**: Cosine similarity via pgvector in Neon PostgreSQL; `SELECT ... ORDER BY embedding <=> $1 LIMIT k` with k=5–10 chunks.
- **Storage**: Embeddings stored in Neon PostgreSQL using pgvector extension. Computed at wiki generation time and stored in the `wiki_embeddings` table with metadata (page ID, section heading, repo ID, wiki version ID). See `database-embeddings-prd.md` for full schema.
- **Re-indexing**: When a wiki is regenerated (e.g., on push to tracked branch), old embeddings are deleted and new ones inserted in a transaction.
- **Re-ranking**: Optional: use a cross-encoder or second-pass retrieval to improve relevance. Defer to future if MVP retrieval is sufficient.
- **Semantic search**: The same pgvector infrastructure powers both Q&A (question → answer) and semantic search (query → matching wiki sections). Shared retrieval layer.

### 7.3 Prompt Strategy

- **System prompt**: Define role (codebase Q&A assistant), citation format (GitHub URL), and instruction to say "I don't know" for out-of-scope questions.
- **User prompt**: Include (a) the question, (b) retrieved wiki chunks (or full wiki), (c) repo metadata (owner, repo, branch), (d) instruction to cite every claim.
- **Few-shot**: Consider 1 example of a well-cited answer in the prompt.

### 7.4 Streaming

- Use OpenAI streaming API (`stream: true`); forward chunks via SSE or WebSocket to the client.
- Client: append chunks to answer div; render markdown incrementally (e.g., `react-markdown` with streaming support or simple append + parse on complete).

### 7.5 Package Boundaries

- Q&A logic belongs in a new package `packages/qa` or as a module in `packages/generator`.
- Depends on: `packages/shared` (types), wiki content (from generator output), analysis result (optional).
- API route in `apps/web` (e.g., `POST /api/wiki/[owner]/[repo]/ask`) invokes the Q&A service.
- MUST NOT depend on `packages/analyzer` directly; consume via shared types.

### 7.6 Rate Limiting Implementation

- Use in-memory store (e.g., `Map`) for single-instance; for serverless, use Vercel KV or Upstash Redis for distributed rate limiting.
- Key: `qa:{owner}:{repo}:{userId|sessionId}` or IP-based for anonymous users.
- Sliding window or fixed window; 10 req/min, 100 req/hour as defaults.

## 8. Dependencies

- **Wiki content**: Q&A REQUIRES generated wiki content (markdown pages). Wiki must be generated before Q&A is available.
- **Analysis result** (optional): For richer answers, analysis data (signatures, file paths) can augment context. Not strictly required for MVP.
- **Repository metadata**: Owner, repo name, default branch—from ingestion or wiki metadata.
- **OpenAI API**: `OPENAI_API_KEY`; model configurable (e.g., `gpt-4o-mini` for cost, `gpt-4o` for quality).
- **Embedding model** (for RAG): `text-embedding-3-small` or equivalent; same API key.
- **Rate limit store**: In-memory for dev; Neon PostgreSQL or Upstash Redis for production.
- **Shared types**: `packages/shared` must define `QAResponse`, `Citation`, and related types.

## 9. Success Metrics

- **Answer relevance**: For 20 curated questions across 5 repos, 80%+ of answers are rated "relevant" or "very relevant" (manual review).
- **Citation accuracy**: 100% of citation URLs resolve to valid file paths in the repo (no 404s for in-repo files).
- **Citation coverage**: 90%+ of factual claims in answers have at least one citation.
- **Out-of-scope handling**: 100% of out-of-scope questions receive a polite "outside scope" response with zero hallucination.
- **Latency**: First token within 5s p95; full answer within 30s p95.
- **Rate limit effectiveness**: Zero incidents of API abuse or unexpected cost spikes from unthrottled requests.
- **User adoption** (if tracked): Q&A usage as % of wiki page views; target 10%+ for repos with Q&A enabled.

## 10. Out of Scope

- **Multi-turn conversation**: Follow-up questions with conversation history; single-turn only for MVP.
- **Code execution**: No running or executing code; answers are from static analysis and wiki only.
- **Real-time code updates**: Q&A uses the wiki as generated at a point in time; no live codebase sync.
- **Multi-repo Q&A**: One repo per wiki; no cross-repo questions.
- **User editing of answers**: Answers are generated, not editable by users.
- **Custom embedding models**: OpenAI embeddings only for MVP; local or alternative models are future work.
- **Q&A for private repos**: Supported — users authenticate via WorkOS (GitHub OAuth), granting access to their private repos.
- **Persistent chat history**: No requirement to store or display past Q&A sessions for MVP; stateless is acceptable.
- **Voice input**: Text input only.

## 11. Open Questions

- **OQ-1**: RAG vs. full context threshold—50K tokens? Need to benchmark cost and quality at boundary.
- **OQ-2**: Should we precompute embeddings at wiki generation time, or compute on-demand? Trade-off: faster first question vs. storage and pipeline complexity.
- **OQ-3**: RESOLVED — Using pgvector in Neon PostgreSQL. HNSW index for cosine similarity. See `database-embeddings-prd.md`.
- **OQ-4**: How to handle questions about code that exists in the repo but wasn't included in the wiki (e.g., low-importance files)? Include analysis data in context, or strictly wiki-only?
- **OQ-5**: Rate limit key: by IP, by session, or by authenticated user? Anonymous users need IP or session-based limits.
- **OQ-6**: Should we support a "simple search bar" that shows a single answer, or a full chat-like interface from day one? UX decision.
- **OQ-7**: Model choice: `gpt-4o-mini` for cost vs. `gpt-4o` for quality. Need cost/quality trade-off analysis.

## 12. Milestones

### M1: Single-Turn Q&A with Full Context (MVP)

- FR-001, FR-002, FR-003, FR-004 (question input, validation, context association)
- FR-005, FR-007, FR-010 (context: full wiki for small repos)
- FR-011, FR-012, FR-013 (answer generation, markdown, streaming)
- FR-014, FR-015, FR-016, FR-017 (citations: format, validity, instruction)
- FR-018 (out-of-scope handling)
- FR-025, FR-026, FR-027 (error handling)
- NFR-001, NFR-003, NFR-004, NFR-005 (performance, interface, testability)
- UI-001, UI-002, UI-003, UI-004, UI-005, UI-006 (core UI)

**Deliverable**: User can ask a question on a wiki page; receive streamed answer with citations. Works for small repos (<50K tokens wiki).

### M2: Rate Limiting & Polish

- FR-021, FR-022, FR-023, FR-024 (rate limiting)
- UI-007, UI-008, UI-009, UI-010 (dark mode, keyboard, empty state, chat styling)
- NFR-006, NFR-007 (token logging, rate limit respect)

**Deliverable**: Rate limiting enforced; polished UI; production-ready for small repos.

### M3: RAG for Large Repos

- FR-006, FR-008, FR-009 (RAG: retrieval, chunking, context)
- Embedding pipeline: chunk wiki, embed, store
- Retrieval: embed question, similarity search, top-k chunks
- NFR-008 (retrieval performance)

**Deliverable**: Q&A works for large repos (100+ feature pages); RAG retrieves relevant chunks; answers remain cited.

### M4: Optimization & Hardening

- Precompute embeddings at wiki generation time (if OQ-2 resolved)
- Vector DB or optimized similarity search (if OQ-3 resolved)
- Extended error handling, logging, monitoring
- Integration tests with fixture wikis

**Deliverable**: Production-hardened Q&A; scales to largest supported repos; cost and latency optimized.
