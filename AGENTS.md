# Agent Working Guide — WikiSmith

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Monorepo** | Turborepo + pnpm |
| **Web App** | Next.js 15 (App Router) |
| **Styling** | Tailwind CSS + shadcn/ui |
| **Database** | Neon PostgreSQL + pgvector |
| **ORM** | Drizzle ORM + Drizzle Kit |
| **Auth** | WorkOS (GitHub OAuth social connection) |
| **AI** | OpenAI SDK (gpt-5-mini + text-embedding-3-small) |
| **Testing** | Vitest + Playwright |
| **Deployment** | Vercel |

## Repository Structure

```
wikismith/
├── apps/
│   └── web/                    # Next.js 15 app (frontend + API routes)
├── packages/
│   ├── analyzer/               # Repository analysis engine
│   ├── generator/              # Wiki content generation (AI)
│   ├── db/                     # Drizzle schema, migrations, client
│   └── shared/                 # Shared types, utils, constants
├── features/                   # Feature PRDs
├── docs/
│   ├── prd/                    # Product requirement documents
│   └── architecture/           # Architecture decision records
├── .cursor/rules/              # Cursor agent rules
├── turbo.json
└── package.json
```

## 1. Build / Lint / Test Commands

The project is a monorepo managed by **pnpm** and **Turborepo**.

| Command | What it does |
|---------|-------------|
| `pnpm install` | Install all workspace packages |
| `pnpm dev` | Start development servers for all apps |
| `pnpm build` | Build all packages and apps |
| `pnpm lint` | Run ESLint + Prettier across the repo |
| `pnpm test` | Run Vitest across all workspaces |
| `pnpm type-check` | TypeScript type-checking on all workspaces |

### Running a Single Test File

```bash
pnpm exec vitest run <relative/path/to/test.ts>
# Or scoped to a workspace:
pnpm test --filter @wikismith/analyzer
```

## 2. Code Style & Conventions

### 2.1 TypeScript Rules

- **Strict mode** enabled everywhere
- No implicit `any` — use `unknown` or explicit generics
- Prefer `as const` for literal arrays/objects
- Use `??` for nullish coalescing (never `||` for null checks)
- Arrow functions only: `() => {}`, never `function() {}`
- Quick returns where possible: `() => result`
- No unused variables or imports

### 2.2 Naming Conventions

| Category | Rule |
|----------|------|
| Variables / constants | `camelCase`, `UPPER_SNAKE_CASE` for env vars |
| Functions | `camelCase`, descriptive names |
| React components | `PascalCase`, filename matches component |
| Types / interfaces | `PascalCase`, prefix interfaces with `I` |
| Enums | `PascalCase` with constant values |

### 2.3 Formatting

- Prettier with single quotes, trailing commas, 100 print width
- ESLint with recommended + TypeScript rules
- Run `pnpm lint` before every commit

### 2.4 Error Handling

- Use try/catch around async operations that may throw
- Create domain-specific error classes extending `AppError`
- Never swallow errors silently
- Log with structured logger, never `console.log` in production

### 2.5 Testing

- Tests in `__tests__/` directories mirroring source
- Use Vitest for unit/integration tests
- Use Playwright for E2E tests
- Prefer explicit assertions over snapshots
- Mock external services (OpenAI, GitHub API) in tests

## 3. Commit Conventions

- Follow Conventional Commits: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`
- Scope to the affected package: `feat(analyzer): add language detection`
- Keep commits atomic and descriptive

## 4. ClickUp — Task Tracking

All implementation tasks are tracked in ClickUp. **Every agent must use ClickUp MCP tools to check and update task status.**

### Workspace Structure

```
WikiSmith (folder)
├── Phase 0 — Foundation        # Monorepo scaffold, DB schema, CI/CD
├── Phase 1 — Core Pipeline     # Ingestion, Analysis, Classification, Generation, UI
├── Phase 2 — Auth & User       # WorkOS auth, Repo dashboard
└── Phase 3 — Advanced          # Embeddings/RAG, Q&A, Versioning/Webhooks
```

### Agent Workflow with ClickUp

**Before starting any implementation work:**

1. **Check the board** — use `clickup_search` with `keywords: "WikiSmith"` and `filters.task_statuses: ["active"]` to see what's in progress
2. **Pick a task** — choose a task that is `to do` and whose dependencies are `complete`
3. **Mark in progress** — use `clickup_update_task` to set `status: "in progress"` before you start
4. **Reference the PRD** — each task description links to a `features/*.md` file; read it first
5. **Update on completion** — set `status: "complete"` when acceptance criteria are met
6. **Comment blockers** — use `clickup_create_task_comment` if blocked or if you have questions

### Task Dependencies (Execution Order)

```
Phase 0 (do first, all in parallel):
  ├── Monorepo Scaffold
  ├── Database Schema (needs Scaffold)
  └── CI/CD Pipeline (needs Scaffold)

Phase 1 + Phase 2 (after Phase 0, these run in parallel):
  Phase 1:
    ├── Repository Ingestion (needs Scaffold + DB)
    ├── Wiki UI skeleton (needs Scaffold — no data dependency)
    ├── Codebase Analysis (needs Ingestion)
    ├── Feature Classification (needs Analysis)
    └── Wiki Content Generation (needs Classification + DB)
  Phase 2:
    ├── Authentication (needs DB)
    └── Repo Dashboard (needs Auth + Generation)

Phase 3 (after Phase 1 + Phase 2):
  ├── Embeddings Pipeline (needs Generation + DB)
  ├── Q&A System (needs Embeddings + Auth)
  └── Wiki Versioning + Webhooks (needs Generation + Auth)
```

### Parallelization Rules

- Multiple agents CAN work on different tasks simultaneously if dependencies allow
- Never work on a task whose dependencies aren't `complete`
- If two agents need to modify the same package, coordinate via ClickUp comments
- When in doubt about conflicts, check `git status` and the ClickUp board

## 5. Agent Roles

Skills are defined in `skills/` and symlinked to `.cursor/rules/` (Cursor) and `.agents/skills/` (OpenCode).

| Agent | Skill File | Purpose |
|-------|-----------|---------|
| PRD Writer | `skills/prd-writer/SKILL.md` | Writes feature PRDs |
| Test Architect | `skills/test-architect/SKILL.md` | Designs test strategies and specs |
| Code Reviewer | `skills/code-reviewer/SKILL.md` | Reviews code quality and patterns |
| Architecture | `skills/architecture/SKILL.md` | Makes and documents architecture decisions |
| UI/UX | `skills/ui-ux/SKILL.md` | Designs and reviews UI components |

## 6. Feature PRD Conventions

- All PRDs live in `features/`
- File names: kebab-case with `-prd.md` suffix (e.g., `repo-analysis-prd.md`)
- Every PRD must include: Goal, Problem Statement, User Stories, Requirements, Technical Notes, Success Metrics, Out of Scope, Open Questions
- Each PRD maps to one or more ClickUp tasks — check the task description for the PRD link

## 7. Git Policy

- Do not commit unless explicitly asked
- All commits use conventional commit format
- PRs use the template at `.github/pull_request_template.md`
- Branch naming: `feat/`, `fix/`, `chore/`, `docs/` prefixes

---

> **Note**: All agents should read this file first for project context before performing any task. Always check ClickUp for current task status before starting work.
