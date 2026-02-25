# Codebase Analysis Engine — PRD

## 1. Goal

Produce a structured, machine-readable representation of a repository's codebase that captures languages, frameworks, build tools, entry points, public APIs, file relationships, and—critically—signals that enable downstream identification of **user-facing features** (not just technical components).

## 2. Problem Statement

After a repository is ingested (cloned/fetched), we have raw files but no semantic understanding. The next pipeline stage—classification and wiki generation—needs to know: What does this codebase do? What are its main capabilities? Where are the important parts? Without structured analysis, we cannot reliably generate useful documentation or distinguish user-facing features from boilerplate, config, or internal plumbing.

Manual inspection of arbitrary repos is impractical. We need an automated engine that parses and understands diverse codebases (multiple languages, frameworks, project structures) and outputs a consistent schema that the generator can consume.

## 3. User Stories

- As a **wiki reader**, I want the generated wiki to reflect the actual features and capabilities of the project, so that I can quickly understand what the software does and how to use it.
- As a **repository maintainer**, I want the analysis to correctly identify my project's entry points and public APIs, so that the wiki accurately represents how users interact with my code.
- As a **WikiSmith developer**, I want a stable JSON output schema from the analyzer, so that the generator and other pipeline stages can depend on a well-defined contract.
- As a **WikiSmith developer**, I want the analyzer to handle repos in Python, JavaScript/TypeScript, Go, Rust, and other common languages, so that we can support a broad range of open-source projects.
- As a **WikiSmith developer**, I want the analyzer to surface existing README and docs content, so that we can incorporate or reference them in the generated wiki.
- As a **WikiSmith developer**, I want the analyzer to distinguish important files (entry points, public APIs, feature modules) from boilerplate (config, generated code, tests), so that we prioritize the right content for documentation.

## 4. Functional Requirements (with FR-xxx IDs)

### 4.1 Language & Ecosystem Detection

- **FR-001**: The analyzer MUST detect the primary and secondary programming languages used in the repository (e.g., TypeScript, Python, Go, Rust, Java, C#, Ruby).
- **FR-002**: The analyzer MUST detect frameworks and libraries (e.g., Next.js, React, Django, Express, Gin, Actix) from configuration files, package manifests, or import patterns.
- **FR-003**: The analyzer MUST detect build tools (e.g., npm/pnpm/yarn, pip/poetry, cargo, go mod, make) and package managers.
- **FR-004**: The analyzer MUST support at least: JavaScript/TypeScript, Python, Go, Rust, Java, C#, Ruby. Additional languages MAY be added incrementally.

### 4.2 Entry Points & Structure

- **FR-005**: The analyzer MUST identify application entry points (e.g., `main.ts`, `index.js`, `main.py`, `main.go`, `Cargo.toml` binaries, `package.json` scripts).
- **FR-006**: The analyzer MUST identify the root(s) of the source tree (e.g., `src/`, `app/`, `packages/`) and distinguish source from config, tests, and generated artifacts.
- **FR-007**: The analyzer MUST produce a file tree or manifest with paths relative to the repo root, including file type and size metadata.

### 4.3 Public APIs & Signatures

- **FR-008**: The analyzer MUST extract exported function, class, and module signatures for supported languages (at minimum: TypeScript/JavaScript, Python).
- **FR-009**: The analyzer MUST identify public vs. internal/private symbols where the language supports it (e.g., `export` vs non-export in JS; `def` with leading underscore in Python).
- **FR-010**: The analyzer MUST capture docstrings or JSDoc comments for exported symbols when present.
- **FR-011**: For unsupported or partially supported languages, the analyzer SHOULD fall back to heuristics (e.g., regex for common patterns) rather than failing silently.

### 4.4 File Relationships

- **FR-012**: The analyzer MUST build an import/export graph: which files import from which, and what symbols are imported.
- **FR-013**: The analyzer MUST identify circular dependencies and flag them in the output.
- **FR-014**: The analyzer SHOULD infer module boundaries (e.g., packages, namespaces) from directory structure and import patterns.

### 4.5 Documentation & README

- **FR-015**: The analyzer MUST locate and extract content from README files (README.md, README.rst, README.txt, etc.) at repo root and in key subdirectories.
- **FR-016**: The analyzer MUST identify existing documentation directories (e.g., `docs/`, `documentation/`, `wiki/`) and list their contents.
- **FR-017**: The analyzer SHOULD extract structured sections from READMEs (e.g., Installation, Usage, API) when they follow common conventions.

### 4.6 Importance & Feature Signals

- **FR-018**: The analyzer MUST apply heuristics to rank files by "importance" for documentation: entry points, exported modules, files with many incoming imports, and files with rich docstrings rank higher.
- **FR-019**: The analyzer MUST flag boilerplate and low-value files: generated code, lock files, minified bundles, config-only files, and common test utilities that don't represent features.
- **FR-020**: The analyzer SHOULD surface signals that help identify user-facing features: e.g., route definitions, CLI commands, public API modules, plugin interfaces.
- **FR-021**: The analyzer MUST NOT assume a single "main" app; monorepos and multi-package projects MUST be represented with multiple entry points and sub-projects.

### 4.7 Output Schema

- **FR-022**: The analyzer MUST produce a single JSON artifact conforming to a defined schema (see Technical Considerations).
- **FR-023**: The output MUST include: detected languages, frameworks, build tools, entry points, file manifest, import graph, extracted signatures, README content references, and importance scores.
- **FR-024**: The output MUST be deterministic for a given repository state (same input → same output, modulo non-deterministic metadata like timestamps if excluded).
- **FR-025**: The analyzer MUST handle parse failures gracefully: partial output with error metadata for failed files, rather than failing the entire analysis.

## 5. Non-Functional Requirements (with NFR-xxx IDs)

- **NFR-001**: The analyzer MUST complete analysis of a typical medium-sized repo (< 10k files) within 60 seconds on standard hardware.
- **NFR-002**: The analyzer MUST operate on the filesystem output of the ingestion stage; it MUST NOT perform network calls (e.g., fetching packages) during analysis.
- **NFR-003**: The analyzer MUST be testable in isolation with fixture repos; all external dependencies (e.g., language runtimes for AST parsing) MUST be explicit and mockable.
- **NFR-004**: The analyzer MUST NOT require installation of project dependencies (e.g., `npm install`) to analyze a repo; it MUST work on static files only.
- **NFR-005**: Memory usage MUST remain bounded; streaming or chunked processing for large file trees is preferred over loading entire repo into memory.
- **NFR-006**: The analyzer MUST be idempotent: running it multiple times on the same input produces equivalent output.

## 6. UI/UX Requirements

- **UI-001**: The Codebase Analysis Engine is a backend pipeline component; it has no direct user-facing UI.
- **UI-002**: Analysis progress and results MAY be surfaced indirectly via the web app (e.g., "Analyzing repository…" status, or display of detected languages/frameworks). These are covered by the web app PRD.
- **UI-003**: Error states (e.g., unsupported language, parse failure) MUST be captured in the output schema so that the UI can display meaningful feedback (e.g., "Analysis completed with warnings").

## 7. Technical Considerations

### 7.1 Parsing Strategy

- **AST parsing** (e.g., TypeScript compiler API, tree-sitter, language-specific parsers) is preferred for accuracy when available. Use for: import/export extraction, signature extraction, structure.
- **Regex/heuristics** are acceptable fallbacks for unsupported languages or when AST tooling is unavailable. Document limitations.
- **AI-powered analysis** (e.g., GPT for ambiguous cases) MAY be used in a future phase for feature classification; this PRD focuses on static analysis. If introduced, it should be a separate, optional stage.

### 7.2 Output Schema (Draft)

The analyzer output MUST conform to a schema similar to the following (exact field names and structure to be finalized in an ADR):

```json
{
  "version": "1.0",
  "repository": { "root": ".", "languages": [], "frameworks": [], "buildTools": [] },
  "entryPoints": [{ "path": "", "type": "application|library|cli", "metadata": {} }],
  "files": [{ "path": "", "language": "", "size": 0, "importanceScore": 0, "isBoilerplate": false }],
  "importGraph": { "nodes": [], "edges": [{ "from": "", "to": "", "symbols": [] }], "circular": [] },
  "signatures": [{ "file": "", "name": "", "kind": "function|class|module", "exported": true, "docstring": "" }],
  "documentation": { "readmes": [], "docDirs": [] },
  "errors": [{ "file": "", "message": "", "severity": "error|warning" }]
}
```

### 7.3 Importance Heuristics (Guidance)

- **High importance**: Entry points, files with `index`/`main` in path, files with many incoming imports, files exporting public API, route/controller files.
- **Low importance / boilerplate**: `node_modules`, `__pycache__`, `dist`, `build`, lock files, `.min.js`, config files with no logic, generated code.
- **Feature signals**: Route definitions (e.g., `get`, `post` in Express; `path` in Next.js), CLI command registrations, plugin/extension interfaces, public SDK modules.

### 7.4 Package Boundaries

- The analyzer lives in `packages/analyzer`. It exports a primary function, e.g. `analyzeRepository(repoPath: string): Promise<AnalysisResult>`.
- It MAY depend on `packages/shared` for types and utilities. It MUST NOT depend on `packages/generator` or `apps/web`.
- Language-specific parsers (e.g., `@typescript-eslint/parser`, `tree-sitter`) should be optional dependencies where possible to keep the core lightweight.

## 8. Dependencies

- **Ingestion stage**: The analyzer REQUIRES a cloned/fetched repository on the local filesystem. The ingestion PRD must define the contract (directory layout, what is included/excluded).
- **Shared types**: The `AnalysisResult` schema (or equivalent) should be defined in `packages/shared` so that both analyzer and generator consume the same types.
- **Language runtimes**: AST parsing for some languages may require runtimes (e.g., Node for TS/JS, Python for Python AST). These must be available in the execution environment or the analyzer must degrade gracefully.
- **No generator dependency**: The analyzer MUST NOT depend on the generator or any AI/LLM calls for this phase.

## 9. Success Metrics

- **Correctness**: For a curated set of 10+ fixture repos (spanning TS, Python, Go, Rust), the analyzer correctly identifies languages, frameworks, and at least one entry point in 100% of cases.
- **Completeness**: For supported languages, import graph coverage is ≥ 95% of actual imports (measured against manual audit of a sample).
- **Performance**: Analysis of a 5k-file repo completes in < 30 seconds p95.
- **Stability**: Zero unhandled exceptions; all parse failures result in partial output with error metadata.
- **Schema compliance**: Output validates against the published JSON schema in 100% of successful runs.

## 10. Out of Scope

- **Feature classification**: Identifying *which* code implements *which* user-facing feature (e.g., "this is the login feature") is a separate stage (classification). This PRD covers structural analysis only.
- **Wiki generation**: Content generation, AI summarization, and rendering are out of scope.
- **Runtime analysis**: No execution of code, no dynamic analysis, no dependency resolution beyond static manifest parsing.
- **Private repo auth**: The analyzer assumes it receives a local copy of the repo; authentication and cloning are ingestion concerns.
- **Incremental analysis**: Re-analyzing only changed files is a future optimization; this PRD assumes full analysis each run.
- **Natural language understanding of code**: Semantic understanding of what code "does" (beyond signatures and structure) is out of scope for this phase.

## 11. Open Questions

- **OQ-1**: Should we use a single multi-language parser (e.g., tree-sitter for many languages) vs. language-specific parsers (e.g., TypeScript compiler API for TS)? Trade-off: consistency vs. accuracy per language.
- **OQ-2**: What is the minimum supported set of languages for v1? All of FR-004 or a subset?
- **OQ-3**: How do we handle repos with multiple unrelated projects in one repo (e.g., `frontend/` and `backend/` as separate apps)? Should the output explicitly model "sub-projects"?
- **OQ-4**: Should importance scores be 0–1 normalized, or a discrete tier (high/medium/low)? Affects downstream consumer logic.
- **OQ-5**: Do we need to support analysis of partial/cloned repos (e.g., shallow clone with only certain paths)? May affect ingestion contract.

## Implementation Status

> Last updated: 2026-02-25

### What's Implemented
- Language and framework detection from manifests and file extensions
- Entry point identification (main files, package.json scripts)
- File importance scoring with heuristics
- Import graph construction for JS/TS
- Function/class signature extraction for JS/TS
- Analysis produces `IAnalysisResult` matching output schema
- Pure static analysis, no network calls required

### What's Not Yet Implemented
- Go, Rust, Java, C#, Ruby support
- Deep AST parsing (currently uses regex heuristics)

### Current Limitations
- Only JS/TS and Python fully supported; other languages fall back to heuristics or are unsupported.

## 12. Milestones

### M1: Foundation (MVP)
- FR-001, FR-002, FR-003 (language, framework, build tool detection)
- FR-005, FR-006, FR-007 (entry points, source roots, file manifest)
- FR-022, FR-023, FR-025 (output schema, partial failure handling)
- Support: TypeScript/JavaScript, Python
- NFR-002, NFR-004, NFR-006

### M2: Structure & Relationships
- FR-008, FR-009, FR-010 (signature extraction for TS/JS, Python)
- FR-012, FR-013 (import graph, circular deps)
- FR-015, FR-016 (README, doc dirs)
- NFR-001 (performance target)

### M3: Importance & Polish
- FR-018, FR-019, FR-020, FR-021 (importance heuristics, boilerplate, feature signals, monorepos)
- FR-011 (fallback heuristics for additional languages)
- FR-004 expansion: Go, Rust
- NFR-003, NFR-005

### M4: Extended Language Support
- FR-004: Java, C#, Ruby
- FR-017 (structured README sections)
- Schema versioning and backward compatibility
