# Wiki Content Generation — PRD

## 1. Goal

Transform the classified feature tree (output of the analysis and classification pipeline) into human-readable wiki documentation pages—each subsystem gets a well-structured page with feature description, public interfaces, inline citations linking to source code, and cross-references to related features.

## 2. Problem Statement

After analysis and classification, we have a structured representation of what the codebase does and which code belongs to which feature. But developers need **readable documentation**—prose that explains purpose, behavior, and how to use each subsystem. Raw analysis output (file paths, signatures, import graphs) is not consumable by humans.

Without content generation:
- Users cannot quickly understand what a feature does or how it works
- There is no narrative connecting code to user-facing capabilities
- Claims about the codebase cannot be verified—no links back to source
- The wiki would be a skeleton with no substance

The generator must produce accurate, useful, well-structured markdown that captures a **broad understanding** of the codebase—not surface-level summaries—while maintaining **citation integrity**: every technical claim must link back to specific source code.

## 3. User Stories

- As a **developer exploring an unfamiliar repo**, I want each feature page to describe what the subsystem does and how it works, so that I can quickly orient myself without reading all the code.
- As a **developer**, I want every technical claim in the wiki to link to the exact file and line(s) in the source, so that I can verify and dive deeper when needed.
- As a **developer**, I want to see public interfaces and entry points for each feature, so that I know where to start when I need to use or extend it.
- As a **developer**, I want code snippets from the actual repository in the wiki, so that I see real examples without switching context.
- As a **developer**, I want a wiki home page that gives an overview of all features and how they relate, so that I can navigate the documentation efficiently.
- As a **repository maintainer**, I want the generated wiki to be accurate and useful, so that it can serve as living documentation for my project.
- As a **WikiSmith developer**, I want the generator to handle large features that exceed AI token limits, so that we never truncate or fail silently.
- As a **WikiSmith developer**, I want content quality validation, so that we can detect and surface inaccurate or low-quality output.

## 4. Functional Requirements (with FR-xxx IDs)

### 4.1 Input & Output

- **FR-001**: The generator MUST accept as input: (a) the classified feature tree, (b) the analysis result (from the analyzer), (c) repository metadata (owner, name, default branch, base URL for GitHub).
- **FR-002**: The generator MUST produce wiki content as structured markdown files—one page per feature/subsystem, plus a home/index page.
- **FR-003**: The generator MUST output content in a format consumable by the rendering stage (e.g., markdown files with frontmatter for metadata).
- **FR-004**: The generator MUST preserve the hierarchical structure of the feature tree in the output (e.g., nested features map to nested pages or sections).

### 4.2 Page Content Structure

- **FR-005**: Each feature page MUST include: (a) overview/description, (b) how it works (behavior, flow), (c) key interfaces/entry points, (d) related features, (e) source references (citations).
- **FR-006**: The overview MUST be a human-readable summary of the feature's purpose and role in the system—not a restatement of file names.
- **FR-007**: The "how it works" section MUST explain behavior, data flow, or control flow where relevant—aiming for broad understanding, not surface-level.
- **FR-008**: Key interfaces MUST list public functions, classes, modules, or entry points with signatures and brief descriptions.
- **FR-009**: Related features MUST be explicitly listed with links to their wiki pages.
- **FR-010**: Source references MUST be a structured list or inline citations (see FR-011) linking to the primary files implementing the feature.

### 4.3 Citations (Critical)

- **FR-011**: Every technical claim in the wiki (e.g., "authentication is handled by `validateToken`") MUST have an inline citation linking to the specific source location.
- **FR-012**: Citation format MUST be GitHub blob URLs: `https://github.com/{owner}/{repo}/blob/{branch}/{path}#L{start}-L{end}` (or equivalent for single-line: `#L{line}`).
- **FR-013**: Citations MUST reference the correct branch (default branch from repo metadata) and valid file paths.
- **FR-014**: Line numbers in citations MUST correspond to the actual location of the referenced code (function, class, or relevant block).
- **FR-015**: The generator MUST include at least one citation per major section of each feature page (overview, interfaces, behavior).
- **FR-016**: Code snippets included in the wiki MUST be extracted from the actual repository and MUST include a citation link to their source location.

### 4.4 Code Snippets

- **FR-017**: The generator SHOULD include relevant code snippets (functions, class definitions, config examples) where they aid understanding.
- **FR-018**: Code snippets MUST be syntactically valid and accurately extracted from the source—no hallucinated code.
- **FR-019**: Code snippets MUST use the correct language tag for syntax highlighting (e.g., ` ```typescript `).
- **FR-020**: Long snippets (> ~20 lines) SHOULD be truncated with ellipsis and a "see full source" citation.

### 4.5 Wiki Home Page

- **FR-021**: The generator MUST produce a wiki home/index page.
- **FR-022**: The home page MUST include: (a) repository name and description, (b) overview of all top-level features/subsystems, (c) navigation links to each feature page, (d) optional: quick search or table of contents.
- **FR-023**: The home page MUST present a high-level map of the codebase—what the project does and how major features relate.

### 4.6 Token Limits & Chunking

- **FR-024**: The generator MUST handle features whose context exceeds the AI model's token limit (e.g., 128K for GPT-4).
- **FR-025**: For large features, the generator MUST split generation into multiple AI calls (e.g., by sub-features, or by logical sections) and merge results.
- **FR-026**: The generator MUST NOT truncate or drop content silently when context is large; it MUST use a chunking strategy that preserves completeness.
- **FR-027**: Chunking boundaries SHOULD align with logical units (sub-features, files, or modules) rather than arbitrary token cuts.

### 4.7 Content Quality & Validation

- **FR-028**: The generator MUST validate that all citation URLs are well-formed and reference existing files in the analysis result.
- **FR-029**: The generator SHOULD perform basic content quality checks: non-empty sections, presence of citations in each section, no placeholder text (e.g., "TODO", "TBD").
- **FR-030**: The generator MUST surface validation failures (invalid citations, missing sections) as warnings or errors in the output metadata—not silently ignore them.
- **FR-031**: The generator SHOULD detect and flag potential hallucinations (e.g., references to files not in the analysis, claims about code that doesn't exist).

### 4.8 Markdown Formatting

- **FR-032**: Output markdown MUST use proper structure: `#` for page title, `##` for major sections, `###` for subsections.
- **FR-033**: Output MUST use consistent markdown conventions: fenced code blocks, bullet lists, numbered lists where appropriate, bold/italic for emphasis.
- **FR-034**: Internal links between wiki pages MUST use relative paths (e.g., `./authentication.md`, `../parent-feature.md`).
- **FR-035**: External links (GitHub citations) MUST use absolute URLs and SHOULD open in a new tab when rendered (handled by renderer).

### 4.9 Error Handling & Progressive Enhancement

- **FR-036**: If generation fails for a single feature, the generator MUST continue with other features and report partial success.
- **FR-037**: Failed features MUST be recorded in output metadata with error reason (e.g., "AI timeout", "token limit exceeded", "invalid response").
- **FR-038**: The generator MUST NOT fail the entire run due to one feature; partial wiki output is acceptable.
- **FR-039**: If the AI returns malformed or empty content, the generator SHOULD retry (with backoff) up to a configurable limit before marking as failed.

## 5. Non-Functional Requirements (with NFR-xxx IDs)

- **NFR-001**: The generator MUST isolate OpenAI/LLM calls behind a clean interface (e.g., `IContentGenerator`) for testability and swapability.
- **NFR-002**: The generator MUST be testable with mocked AI responses; no real API calls in unit tests.
- **NFR-003**: Generation of a typical feature page (single AI call) SHOULD complete within 30 seconds p95.
- **NFR-004**: For a repo with 20 features, full wiki generation SHOULD complete within 10 minutes p95 (allowing for rate limits and chunking).
- **NFR-005**: The generator MUST respect OpenAI rate limits; implement backoff and optional queuing for concurrent requests.
- **NFR-006**: Memory usage MUST remain bounded; stream or process features sequentially or in small batches rather than loading all context at once.
- **NFR-007**: The generator MUST NOT store or log sensitive data (API keys, repo tokens); use environment variables for configuration.
- **NFR-008**: Output MUST be deterministic for a given input when using deterministic AI parameters (temperature=0); non-determinism from AI is acceptable but should be documented.

## 6. UI/UX Requirements

- **UI-001**: The generator is a backend component; it has no direct UI. UI requirements apply to the *rendered* wiki output.
- **UI-002**: Generated content MUST be structured for the page templates defined in the UI/UX agent rules: breadcrumb navigation, table of contents, related features sidebar.
- **UI-003**: Citation links MUST be visually distinguishable in the rendered wiki (e.g., inline link, icon, or "View source" badge)—implementation in renderer.
- **UI-004**: Content MUST be scannable: clear headers, bullet points, code blocks with syntax highlighting support.
- **UI-005**: Long pages SHOULD have sufficient heading hierarchy to support automatic table-of-contents generation.
- **UI-006**: The home page MUST be designed for quick orientation—developers should understand the project in under 60 seconds of reading.

## 7. Technical Considerations

### 7.1 Input Contract

The generator consumes:

- **Classified feature tree**: A tree structure where each node represents a feature/subsystem, with:
  - `id`, `name`, `description` (optional, from classification)
  - `filePaths`: array of file paths belonging to this feature
  - `children`: nested sub-features
  - `entryPoints`: optional list of entry point identifiers (from analysis)
- **Analysis result**: From the analyzer (see `codebase-analysis-engine-prd.md` §7.2): `entryPoints`, `files`, `importGraph`, `signatures`, `documentation`, etc.
- **Repo metadata**: `owner`, `repo`, `defaultBranch`, `baseUrl` (e.g., `https://github.com`)

Exact schema to be finalized in `packages/shared` and documented in an ADR.

### 7.2 AI Prompt Strategy

- System prompt: Define the role (technical writer), output format (markdown with citations), and citation format (GitHub URL).
- User prompt per feature: Include (a) feature name and description, (b) relevant file paths and their content summaries/signatures, (c) import relationships, (d) instruction to cite every claim.
- Context window management: For large features, split by sub-features or by file groups; use a "merge" pass to combine sections if needed.
- Few-shot examples: Consider 1–2 example outputs in the prompt to establish citation style and structure.

### 7.3 Citation Extraction

- Option A: AI returns markdown with inline links; parser extracts and validates URLs.
- Option B: AI returns structured JSON (sections + citations); generator assembles markdown.
- Option C: AI returns markdown; post-processor scans for `[text](url)` and validates URLs against analysis result.
- Recommendation: Start with Option A for simplicity; add validation in post-processing.

### 7.4 Package Boundaries

- The generator lives in `packages/generator`.
- It depends on `packages/shared` for types (feature tree, analysis result, wiki page schema).
- It MUST NOT depend on `packages/analyzer` or `apps/web` directly (consume via shared types).
- OpenAI client should be injectable; use `IContentGenerator` or similar interface for AI calls.

### 7.5 Output Artifact

- Output: A directory or virtual file system of markdown files.
- Structure: `index.md` (home), `{feature-slug}.md` for each feature, optionally `{parent}/{child}.md` for nested features.
- Frontmatter: `title`, `featureId`, `parentFeatureId`, `lastGenerated`, `citationCount`, `warnings` (optional).

## 8. Dependencies

- **Analysis stage**: The generator REQUIRES the analyzer output (analysis result). See `codebase-analysis-engine-prd.md`.
- **Classification stage**: The generator REQUIRES the classified feature tree. A separate PRD for feature classification must define this output; the generator consumes it.
- **Shared types**: `packages/shared` MUST define: `ClassifiedFeatureTree`, `AnalysisResult`, `WikiPage`, `Citation` (or equivalent). Generator and classifier must agree on schema.
- **OpenAI API**: Requires `OPENAI_API_KEY`; model choice (e.g., `gpt-4o-mini`) configurable.
- **Ingestion**: Repo must be cloned; generator may need file contents for code snippets. Contract: generator receives analysis result which references file paths; file content may be passed or read from filesystem depending on architecture.
- **Repository metadata**: Owner, repo name, default branch must be available (from ingestion or user input).

## 9. Success Metrics

- **Citation coverage**: 100% of feature pages have at least one citation per major section (overview, interfaces, behavior).
- **Citation validity**: 100% of citation URLs resolve to valid file paths in the analysis result (no 404s for in-repo files).
- **Content completeness**: 95%+ of features in the tree receive a generated page (excluding intentionally skipped low-value features).
- **Quality (manual audit)**: For 5 curated repos, 2 independent reviewers rate generated wiki "useful" or "very useful" (4+ on 5-point scale) in 80%+ of feature pages.
- **No hallucinations**: Zero instances of code snippets or file references that do not exist in the source (measured by automated validation + sample audit).
- **Performance**: Full wiki for 20-feature repo generated in < 10 minutes p95.
- **Progressive enhancement**: When 1 of N features fails, the rest are still generated; failure rate < 5% per run for typical repos.

## 10. Out of Scope

- **Feature classification**: Identifying which code belongs to which feature is a separate stage. This PRD assumes classification is done.
- **Wiki rendering**: Converting markdown to HTML, styling, navigation UI, search—handled by the web app / renderer.
- **Real-time generation**: This PRD covers batch generation; streaming or incremental updates are future work.
- **Multi-repo wikis**: Single repo per wiki; no aggregation of multiple repos.
- **User editing**: Generated wiki is read-only; no in-place editing or user contributions.
- **Version history**: No tracking of wiki versions over time; each run produces a fresh output.
- **Localization**: English only; no i18n for generated content.
- **Custom templates**: Fixed page structure; user-customizable templates are future work.
- **Diagram generation**: No automatic generation of architecture diagrams, flowcharts, or Mermaid from code (may be future enhancement).

## 11. Open Questions

- **OQ-1**: What is the exact schema for the classified feature tree? The classification PRD must define this; generator depends on it.
- **OQ-2**: Should we support user-provided "hints" or overrides (e.g., "emphasize this file", "skip this feature")? Adds complexity.
- **OQ-3**: For chunking large features: merge sub-feature pages into one, or produce multiple linked pages? Affects navigation and UX.
- **OQ-4**: How do we handle repos with no `README` or minimal documentation? Does the generator degrade gracefully?
- **OQ-5**: Should code snippets be extracted by the generator (reads files) or passed from the analyzer (which already has file content)? Trade-off: analyzer bloat vs. generator file access.
- **OQ-6**: What model for v1? `gpt-4o-mini` is cost-effective; `gpt-4o` may yield higher quality. Need cost/quality trade-off.
- **OQ-7**: Should we support alternative AI providers (Anthropic, local models) from day one, or design for OpenAI first and abstract later?

## Implementation Status

> Last updated: 2026-02-25

### What's Implemented
- Overview page + feature pages + child pages from feature tree
- OpenAI gpt-4o-mini with configurable model
- Citations extracted using regex from markdown output
- Prompts include file contents (truncated to 3000 chars per file)
- Progress callback (onProgress) for streaming
- Stream function (streamWikiPage) for individual page streaming

### What's Not Yet Implemented
- Citation validation
- Quality checks
- Retry on failure
- Hallucination detection
- Chunking for large features that exceed token limits

### Current Limitations
- Citations are extracted via regex; no validation that URLs reference valid files. Large features may hit token limits without chunking.

## 12. Milestones

### M1: Core Generation (MVP)

- FR-001, FR-002, FR-003, FR-004 (input/output, structure)
- FR-005, FR-006, FR-008, FR-009, FR-010 (page structure: overview, interfaces, related, refs)
- FR-011, FR-012, FR-013, FR-014, FR-015 (citations: format, validity, coverage)
- FR-021, FR-022, FR-023 (wiki home page)
- FR-032, FR-033, FR-034, FR-035 (markdown formatting)
- FR-036, FR-037, FR-038 (error handling, partial success)
- NFR-001, NFR-002 (AI interface, testability)

**Deliverable**: Generate a single feature page and home page from fixture data; citations valid.

### M2: Code Snippets & Quality

- FR-016, FR-017, FR-018, FR-019, FR-020 (code snippets)
- FR-007 (how it works—deeper content)
- FR-028, FR-029, FR-030 (validation)
- NFR-003, NFR-005 (performance, rate limits)

**Deliverable**: Code snippets in pages; validation catches invalid citations; basic quality checks.

### M3: Scale & Chunking

- FR-024, FR-025, FR-026, FR-027 (token limits, chunking)
- FR-031 (hallucination detection)
- FR-039 (retry on failure)
- NFR-004, NFR-006 (full wiki performance, memory)

**Deliverable**: Generate wiki for large repos (50+ features, 100k+ LOC); no truncation; chunking works.

### M4: Polish & Hardening

- NFR-007, NFR-008 (security, determinism)
- Extended validation and quality metrics
- Integration with classification stage (end-to-end pipeline test)
- Documentation and ADRs for prompt strategy, citation format

**Deliverable**: Production-ready generator; documented; integrated into full pipeline.
