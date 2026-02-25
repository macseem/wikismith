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
│   └── web/                    # Next.js 16 app (frontend + API routes)
├── packages/
│   ├── analyzer/               # Repository ingestion + analysis engine
│   ├── generator/              # Wiki content generation (AI)
│   ├── db/                     # Drizzle schema, migrations, client (Neon)
│   ├── shared/                 # Shared types, utils, constants
│   ├── eslint-config/          # Shared ESLint flat config
│   └── tsconfig/               # Shared TypeScript configs
├── terraform/                  # Cloudflare DNS (wikismith.dudkin-garage.com)
├── .github/workflows/          # CI — Blacksmith runner
├── features/                   # Feature PRDs
├── docs/
│   └── architecture/           # Architecture decision records
├── skills/                     # Shared skills (Cursor + OpenCode)
├── .cursor/rules/              # Symlinks to skills/ (Cursor)
├── .agents/skills/             # Symlinks to skills/ (OpenCode)
├── vercel.json                 # Vercel deployment config
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

All implementation tasks are tracked in ClickUp. **Every agent must use ClickUp MCP tools to check and update task status before and after work.**

### Available Statuses

The ClickUp space uses two statuses:

| Status | Meaning |
|--------|---------|
| `to do` | Not started — available for pickup |
| `complete` | Done — acceptance criteria met |

> **No "in progress" status exists.** When starting a task, add a comment via `clickup_create_task_comment` stating you are working on it. Set `complete` when done.

### Workspace Structure

```
WikiSmith (folder)
├── Phase 0 — Foundation        # Monorepo scaffold, DB schema, CI/CD
├── Phase 1 — Core Pipeline     # Ingestion, Analysis, Classification, Generation, UI
├── Phase 2 — Auth & User       # WorkOS auth, Repo dashboard
└── Phase 3 — Advanced          # Embeddings/RAG, Q&A, Versioning/Webhooks
```

### Remaining Tickets (pick from here)

| Task ID | Task Name | Phase | Status | Dependencies |
|---------|-----------|-------|--------|-------------|
| `86c8ez71x` | CI/CD Pipeline & Vercel Deployment Baseline | 0 | `to do` | Scaffold ✅ |
| `86c8ez7tz` | Authentication & Authorization (WorkOS + GitHub OAuth) | 2 | `to do` | DB Schema ✅ |
| `86c8ez7xk` | Repository Management Dashboard | 2 | `to do` | Auth |
| `86c8ez82a` | Embeddings Pipeline & RAG Infrastructure | 3 | `to do` | Generation ✅, DB ✅ |
| `86c8ez851` | Q&A System (RAG + Streaming) | 3 | `to do` | Embeddings, Auth |
| `86c8ez87w` | Wiki Versioning & Auto-Update (Webhooks) | 3 | `to do` | Generation ✅, Auth |

Tasks with all dependencies marked ✅ are **ready for pickup now**.

### Agent Workflow with ClickUp

**Before starting any implementation work:**

1. **Check the board** — use `clickup_search` with `keywords` for the task name to see current status
2. **Pick a task** — choose a task from the table above that is `to do` and whose dependencies are all `complete`
3. **Comment start** — use `clickup_create_task_comment` to note you are starting work (e.g., "🚧 Starting implementation on branch feat/auth")
4. **Reference the PRD** — each task description links to a `features/*.md` file; read it first
5. **Mark complete** — use `clickup_update_task` with `status: "complete"` when acceptance criteria are met
6. **Comment blockers** — use `clickup_create_task_comment` if blocked or if you have questions

### Task Dependencies (Execution Order)

```
Phase 0 — Foundation (✅ mostly complete):
  ├── Monorepo Scaffold              ✅ complete
  ├── Database Schema & Migrations   ✅ complete
  └── CI/CD Pipeline & Vercel        ⬜ to do (Vercel config done, needs deploy)

Phase 1 — Core Pipeline (✅ complete):
  ├── Repository Ingestion           ✅ complete
  ├── Codebase Analysis              ✅ complete
  ├── Feature Classification         ✅ complete
  ├── Wiki Content Generation        ✅ complete
  └── Wiki UI & Navigation           ✅ complete

Phase 2 — Auth & User (⬜ ready to start):
  ├── Authentication (WorkOS)        ⬜ to do — READY (deps: DB ✅)
  └── Repo Dashboard                 ⬜ to do (deps: Auth)

Phase 3 — Advanced (⬜ partially ready):
  ├── Embeddings Pipeline & RAG      ⬜ to do — READY (deps: Generation ✅, DB ✅)
  ├── Q&A System                     ⬜ to do (deps: Embeddings, Auth)
  └── Wiki Versioning + Webhooks     ⬜ to do (deps: Generation ✅, Auth)
```

### Parallelization Rules

- Multiple agents CAN work on different tasks simultaneously if dependencies allow
- Never work on a task whose dependencies aren't `complete`
- Tasks marked **READY** above can be started immediately
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

## 8. CI/CD Notes

- CI runs on GitHub Actions with `ubuntu-latest` (see `.github/workflows/ci.yml`)
- **Blacksmith migration**: once the repo moves to a GitHub **organization** (not personal), migrate CI to [Blacksmith](https://blacksmith.sh/) runners for faster builds:
  - Change `runs-on: ubuntu-latest` → `runs-on: blacksmith-2vcpu-ubuntu-2404`
  - Change `actions/setup-node@v4` → `useblacksmith/setup-node@v5`
  - Blacksmith does not support personal repositories — org-level only
- Deployment target: Vercel with custom domain `wikismith.dudkin-garage.com` (Cloudflare DNS via Terraform in `terraform/`)

---

> **Note**: All agents should read this file first for project context before performing any task. Always check ClickUp for current task status before starting work.
