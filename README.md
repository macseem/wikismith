# WikiSmith

AI-powered wiki generation for code repositories. Paste a GitHub URL, get beautiful, feature-organized developer documentation with semantic search and AI Q&A.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Turborepo + pnpm |
| Web App | Next.js 16 (App Router) |
| Styling | Tailwind CSS + shadcn/ui |
| Database | Neon PostgreSQL + pgvector |
| ORM | Drizzle ORM + Drizzle Kit |
| Auth | WorkOS (GitHub OAuth) |
| AI | OpenAI (gpt-5-mini + text-embedding-3-small) |
| Testing | Vitest + Playwright |
| Deployment | Vercel |

## Project Structure

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
├── .github/workflows/          # CI (GitHub Actions)
├── features/                   # Feature PRDs
├── docs/
│   └── architecture/           # Architecture Decision Records (ADRs)
├── skills/                     # Shared skills (Cursor + OpenCode)
├── vercel.json                 # Vercel deployment config
├── turbo.json
└── package.json
```

## Feature PRDs

### Core Pipeline

| Feature | PRD | Description |
|---------|-----|-------------|
| Repository Ingestion | [repository-ingestion-discovery-prd.md](features/repository-ingestion-discovery-prd.md) | Fetch repos (public + private), extract files |
| Codebase Analysis | [codebase-analysis-engine-prd.md](features/codebase-analysis-engine-prd.md) | Parse code, detect languages, extract structure |
| Feature Classification | [feature-classification-subsystem-detection-prd.md](features/feature-classification-subsystem-detection-prd.md) | AI-powered user-facing feature detection |
| Wiki Content Generation | [wiki-content-generation-prd.md](features/wiki-content-generation-prd.md) | Generate wiki pages with citations |

### User-Facing Features

| Feature | PRD | Description |
|---------|-----|-------------|
| Auth & Authorization | [authentication-authorization-prd.md](features/authentication-authorization-prd.md) | WorkOS + GitHub OAuth |
| Repository Management | [repository-management-prd.md](features/repository-management-prd.md) | Dashboard, repo list, settings |
| Wiki UI & Navigation | [wiki-ui-navigation-prd.md](features/wiki-ui-navigation-prd.md) | Sidebar, search, TOC, dark mode |
| Q&A System | [qa-system-prd.md](features/qa-system-prd.md) | AI Q&A with RAG + pgvector |

### Infrastructure

| Feature | PRD | Description |
|---------|-----|-------------|
| Database & Embeddings | [database-embeddings-prd.md](features/database-embeddings-prd.md) | Neon + pgvector schema, RAG pipeline |
| Wiki Versioning | [wiki-versioning-auto-update-prd.md](features/wiki-versioning-auto-update-prd.md) | Commit-pinned wikis, webhooks |
| Deployment | [deployment-infrastructure-prd.md](features/deployment-infrastructure-prd.md) | Vercel, CI/CD, environment |

## Skills/Agents

Shared skills for both Cursor and OpenCode. Canonical files in `skills/`, symlinked to `.cursor/rules/` (Cursor) and `.agents/skills/` (OpenCode).

| Skill | Definition | Purpose |
|-------|-----------|---------|
| PRD Writer | [skills/prd-writer/SKILL.md](skills/prd-writer/SKILL.md) | Writes feature PRDs |
| Test Architect | [skills/test-architect/SKILL.md](skills/test-architect/SKILL.md) | Designs test strategies |
| Code Reviewer | [skills/code-reviewer/SKILL.md](skills/code-reviewer/SKILL.md) | Reviews code quality |
| Architecture | [skills/architecture/SKILL.md](skills/architecture/SKILL.md) | Architecture decisions |
| UI/UX | [skills/ui-ux/SKILL.md](skills/ui-ux/SKILL.md) | UI design and review |
