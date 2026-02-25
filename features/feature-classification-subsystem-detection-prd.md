# Feature Classification & Subsystem Detection — PRD

## 1. Goal

Transform raw repository analysis output into a hierarchical, user-facing feature map that groups code by what the software *does* for users—not by technical layers—enabling the wiki generator to produce documentation organized around capabilities rather than implementation structure.

## 2. Problem Statement

Raw code analysis produces flat or technically-oriented outputs: file lists, dependency graphs, language stats, and module boundaries. A developer exploring an unfamiliar repo needs to understand *features*: "How does user authentication work?" or "Where is the onboarding flow implemented?"—not "Where is the frontend folder?" or "What's in the API layer?"

Technical groupings (e.g., "Frontend", "API", "Backend", "Utils") are easy to infer but useless for users. A wiki must be organized by *user-facing features* (e.g., "User onboarding flow", "Authentication", "Dashboard analytics", "Export to PDF") so that readers can quickly find what they care about.

The challenge: **AI must classify code into user-facing features/subsystems**—a task requiring semantic understanding of code purpose, cross-file relationships, and architectural patterns. This classification must work across diverse repo architectures (monoliths, microservices, CLI tools, libraries) and scale to large codebases that exceed token limits.

## 3. User Stories

- **US-1**: As a developer exploring an unfamiliar repo, I want the wiki to group documentation by user-facing features (e.g., "Authentication", "Dashboard") so that I can find what I need without understanding the codebase structure first.

- **US-2**: As a developer, I want each feature to list relevant files with their *role* (e.g., "handles login form UI", "validates JWT tokens") so that I know which files to read for a specific capability.

- **US-3**: As a developer working on a monolith, I want features to be extracted from a single codebase without artificial boundaries (e.g., not "Frontend vs Backend").

- **US-4**: As a developer working on a microservices repo, I want features to span services when relevant (e.g., "Checkout flow" includes both order-service and payment-service).

- **US-5**: As a developer working on a CLI tool or library, I want features to reflect commands or capabilities (e.g., "Build command", "Watch mode", "Plugin API") rather than generic technical buckets.

- **US-6**: As a developer with a large repo, I want the system to complete classification without running out of tokens or failing silently.

- **US-7**: As a wiki consumer, I want a clear hierarchy (features → sub-features → files) so that I can drill down into specific areas.

## 4. Functional Requirements (with FR-xxx IDs)

### 4.1 Input & Output

- **FR-001**: The classifier must accept input from the repository analyzer in a defined schema (e.g., file list with metadata, directory structure, dependency graph, language stats, README content).

- **FR-002**: The classifier must produce a hierarchical feature tree where each node has: `name`, `description`, `relevantFiles` (array of `{ path, role }`), and optional `children` (sub-features).

- **FR-003**: Each file in `relevantFiles` must include a `role` string describing the file's purpose within that feature (e.g., "Renders login form", "Validates JWT tokens", "API route handler").

- **FR-004**: The output schema must be consumable by the wiki generator without transformation (e.g., JSON or typed object).

### 4.2 Classification Logic

- **FR-005**: Classification must produce **user-facing features** (e.g., "User onboarding flow", "Authentication", "Dashboard analytics")—never technical groupings (e.g., "Frontend", "API", "Backend", "Utils").

- **FR-006**: The classifier must support at least two levels of hierarchy: top-level features and sub-features (e.g., "Authentication" → "Login", "Logout", "Password reset").

- **FR-007**: A single file may appear in multiple features when it serves multiple capabilities (e.g., a shared auth utility in both "Login" and "Password reset").

- **FR-008**: The classifier must handle repos with no clear feature structure (e.g., single-file scripts) by producing a minimal feature set (e.g., "Core functionality" with one file).

### 4.3 Architecture Awareness

- **FR-009**: The classifier must adapt to different repo types: **monolith** (single codebase), **microservices** (multiple services), **CLI tool** (commands, flags), **library** (public API, modules).

- **FR-010**: For microservices, features may span multiple services; the classifier must not artificially split by service boundary when a feature is cross-cutting.

- **FR-011**: For CLI tools, features should map to commands, subcommands, or major capabilities (e.g., "Build", "Watch", "Deploy").

- **FR-012**: For libraries, features should map to public modules, APIs, or major capabilities (e.g., "Query builder", "Migrations", "ORM").

### 4.4 Scalability & Token Limits

- **FR-013**: The classifier must handle repos that exceed the model's context window (e.g., 128K tokens) via a chunking strategy.

- **FR-014**: The chunking strategy must produce a coherent final output—no orphaned features or duplicate top-level entries.

- **FR-015**: The classifier must support a configurable maximum number of top-level features (e.g., 5–15) to avoid overwhelming the wiki or exceeding downstream token limits.

### 4.5 AI Integration

- **FR-016**: Classification must use OpenAI (gpt-5-mini or equivalent) as the primary inference engine.

- **FR-017**: The classifier must expose a clear interface for AI calls (e.g., `classifyFeatures(analysisOutput): Promise<FeatureTree>`) to support mocking in tests.

- **FR-018**: The classifier must handle API errors (rate limits, timeouts) with retry logic and surface clear errors to the caller.

## 5. Non-Functional Requirements (with NFR-xxx IDs)

- **NFR-001**: Classification for a typical repo (e.g., 2K LOC, 50 files) should complete within 30 seconds under normal API conditions.

- **NFR-002**: Classification must be deterministic for the same input (or document when non-determinism is acceptable, e.g., temperature > 0).

- **NFR-003**: The classifier must not expose internal implementation details in prompts; API keys and secrets must be handled via environment variables.

- **NFR-004**: The output must be serializable (JSON) for caching, debugging, and replay.

- **NFR-005**: Token usage must be tracked and logged for cost monitoring and optimization.

## 6. UI/UX Requirements

- **UI-1**: No direct UI for this feature—it runs as a pipeline step. The wiki UI (feature grid, feature pages) consumes the output indirectly.

- **UI-2**: If classification fails, the wiki generator must handle gracefully (e.g., fallback to flat file list or show error state with retry option).

- **UI-3**: The feature names and descriptions produced by the classifier must be suitable for display in wiki navigation (e.g., human-readable, concise, not technical jargon).

## 7. Technical Considerations

### 7.1 Multi-Pass AI Approach

- **Pass 1 (Broad)**: Given full repo context (or summary), identify 5–15 top-level user-facing features. Output: list of feature names + brief descriptions.
- **Pass 2 (Refine)**: For each feature, assign relevant files with roles. May use chunking if file count is high.
- **Pass 3 (Optional)**: For features with many files, optionally split into sub-features.

Alternative: single-pass with structured output (e.g., JSON mode) if context fits. Multi-pass should be the default for large repos.

### 7.2 Prompt Engineering

- **System prompt**: Instruct the model to think in *user-facing capabilities*: "What can a user do with this software? What problems does it solve?"
- **Negative examples**: "Do NOT output: Frontend, API, Backend, Utils, Services, Components."
- **Positive examples**: "DO output: User onboarding, Authentication, Dashboard analytics, Export to PDF."
- **Role descriptions**: "For each file, describe its role in 1–10 words from a user's perspective."

### 7.3 Chunking Strategy for Large Repos

- **Option A**: Summarize by directory first; pass summaries to AI; then drill down into high-signal directories.
- **Option B**: Split files into chunks by directory/module; classify each chunk; merge results with a final pass to resolve overlaps and deduplicate.
- **Option C**: Use a two-phase approach: (1) directory-level feature mapping, (2) file-level assignment within each directory.

Chunk size must respect token limits (e.g., ~100K tokens per request with buffer for response).

### 7.4 Data Model (Suggested)

```typescript
interface FeatureNode {
  name: string;
  description: string;
  relevantFiles: Array<{ path: string; role: string }>;
  children?: FeatureNode[];
}

interface ClassificationResult {
  features: FeatureNode[];
  metadata: {
    repoType: 'monolith' | 'microservices' | 'cli' | 'library' | 'unknown';
    totalFiles: number;
    tokenUsage?: number;
  };
}
```

### 7.5 Package Placement

- Classification logic belongs in `packages/generator` (AI-driven) or a new `packages/classifier` package if the pipeline grows. Recommendation: start in `generator` as a submodule.

## 8. Dependencies

- **Dependencies**:
  - Repository analyzer must produce output in a defined schema (file list, structure, metadata).
  - OpenAI API access (env: `OPENAI_API_KEY`).
  - Shared types package for `FeatureNode`, `ClassificationResult` (if used across packages).

- **Blockers**:
  - Analyzer must be implemented and produce output before classification can run.
  - Wiki generator must be designed to consume `ClassificationResult` (or equivalent).

## 9. Success Metrics

- **SM-1**: Manual review: For 5 diverse repos (monolith, microservices, CLI, library, mixed), 80%+ of top-level features are user-facing (not technical).
- **SM-2**: No technical groupings in output: Zero occurrences of "Frontend", "API", "Backend", "Utils" as top-level feature names.
- **SM-3**: File coverage: 90%+ of analyzed files appear in at least one feature's `relevantFiles`.
- **SM-4**: Role quality: 80%+ of file roles are descriptive and accurate (manual review of sample).
- **SM-5**: Large repo handling: Classification completes for a repo with 500+ files without timeout or token overflow.
- **SM-6**: Downstream: Wiki generator successfully consumes output and produces coherent wiki pages.

## 10. Out of Scope

- **OOS-1**: Real-time or incremental classification; this is a batch step after analysis.
- **OOS-2**: User customization of feature names or groupings (no UI for editing).
- **OOS-3**: Support for non-OpenAI models (e.g., local LLMs, Anthropic); future work.
- **OOS-4**: Code quality or security analysis; classification is structural only.
- **OOS-5**: Cross-repo feature comparison or deduplication.
- **OOS-6**: Automatic detection of feature boundaries from git history or commit patterns.

## 11. Open Questions

- **OQ-1**: Should we support a "confidence" score per feature to allow downstream filtering of low-confidence features?
- **OQ-2**: What is the preferred chunking strategy for repos with 1000+ files? Benchmark needed.
- **OQ-3**: Should we cache classification results by repo URL + commit SHA for cost/performance?
- **OQ-4**: How to handle repos with multiple entry points (e.g., Next.js app + API + CLI in one repo)?
- **OQ-5**: Should we support a "flat" mode for small repos that skips hierarchy to reduce latency?

## 12. Milestones

### M1: Core Classification (MVP)
- Implement single-pass classification with OpenAI
- Input: analyzer output (file list + basic metadata)
- Output: flat feature list with `name`, `description`, `relevantFiles` (path + role)
- Handle repos up to ~50 files (single prompt)
- **Deliverable**: `classifyFeatures()` function that returns `ClassificationResult`

### M2: Hierarchy & Multi-Pass
- Add two-pass approach: (1) identify features, (2) assign files
- Add sub-feature support (children)
- Implement chunking for repos with 50–200 files
- **Deliverable**: Hierarchical `FeatureNode` tree with sub-features

### M3: Architecture Awareness
- Detect repo type (monolith, microservices, CLI, library)
- Adapt prompts and output structure per type
- **Deliverable**: `metadata.repoType` populated; improved feature quality per type

### M4: Scale & Robustness
- Chunking for 200+ files
- Retry logic, error handling, token usage logging
- Integration with wiki generator

### M5: Optimization (Optional)
- Caching by repo + commit
- Tuning prompts based on success metrics
- Optional "flat" mode for small repos
