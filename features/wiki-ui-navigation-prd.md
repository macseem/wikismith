# Wiki UI & Navigation — PRD

## 1. Goal

Deliver a polished, developer-grade documentation experience for WikiSmith-generated wikis—enabling users to navigate feature documentation, search content, explore code citations, and understand unfamiliar codebases through a UI that feels like GitBook, Notion, or Stripe docs. The wiki UI is the primary touchpoint after generation; it must be fast, scannable, and delightful to use.

## 2. Problem Statement

WikiSmith generates structured markdown documentation with inline citations and feature hierarchies. Without a well-designed frontend, that content is unusable. Developers expect documentation sites to have:

- **Instant navigation** — sidebar, breadcrumbs, table of contents so they can jump to what matters
- **Search** — find content without scrolling or memorizing structure
- **Seamless citations** — inline links to GitHub source that feel native, not bolted-on
- **Readable code** — syntax highlighting, copy buttons, proper typography
- **Dark mode** — non-negotiable for developer tools; many read docs in low-light environments
- **Responsive layout** — developers read on phones, tablets, and desktops

Additionally, wiki generation takes time (minutes for large repos). Users need clear feedback during the "submit URL → wait → view wiki" flow: progress indication, estimated time, and graceful handling of failures. A poor generation UX will cause users to abandon before seeing results.

## 3. User Stories

- As a **developer exploring an unfamiliar repo**, I want a clear landing page that explains what the wiki covers and how features are organized, so that I can orient myself in under 60 seconds.
- As a **developer**, I want a persistent sidebar showing the feature hierarchy, so that I can navigate between features without losing context.
- As a **developer**, I want a table of contents on each page that reflects the heading structure, so that I can jump to specific sections within long pages.
- As a **developer**, I want breadcrumbs showing my location in the feature tree, so that I always know where I am and can navigate up.
- As a **developer**, I want to search across all wiki content with a keyboard shortcut (e.g., `/`), so that I can find information quickly without clicking.
- As a **developer**, I want inline code citations that link to GitHub source and open in a new tab, so that I can verify claims and dive into implementation seamlessly.
- As a **developer**, I want code blocks with syntax highlighting and a copy button, so that I can read and reuse code easily.
- As a **developer**, I want dark mode by default (with optional light mode), so that I can read comfortably in any environment.
- As a **developer on mobile**, I want the wiki to be fully usable on small screens, so that I can read docs on the go.
- As a **user submitting a repo URL**, I want clear feedback during wiki generation (progress, estimated time), so that I know the system is working and when to expect results.
- As a **user**, I want meaningful error messages when generation fails, so that I understand what went wrong and what to do next.
- As a **developer**, I want keyboard navigation (e.g., `/` for search, `Esc` to close modals), so that I can use the wiki efficiently without reaching for the mouse.

## 4. Functional Requirements (with FR-xxx IDs)

### 4.1 Landing / Home Page

- **FR-001**: The wiki MUST have a dedicated home/landing page as the default route when viewing a generated wiki.
- **FR-002**: The home page MUST display: (a) repository name and description, (b) overview of all top-level features/subsystems, (c) navigation links to each feature page, (d) last generated timestamp.
- **FR-003**: The home page MUST present a high-level map of the codebase—what the project does and how major features relate—enabling orientation in under 60 seconds.
- **FR-004**: The home page MUST include a hero or header section with repo metadata (owner, repo name, optional GitHub link).
- **FR-005**: The home page MUST provide a quick search input or prominent search affordance (e.g., "Search wiki" placeholder).

### 4.2 Sidebar Navigation

- **FR-006**: The wiki MUST have a persistent sidebar displaying the feature hierarchy (tree structure from the classified feature tree).
- **FR-007**: The sidebar MUST show expandable/collapsible nodes for features with sub-features.
- **FR-008**: The sidebar MUST highlight the currently active page/feature.
- **FR-009**: The sidebar MUST be collapsible on smaller viewports (e.g., hamburger menu, overlay drawer).
- **FR-010**: The sidebar MUST persist scroll position and expansion state during navigation where feasible (e.g., via URL or session storage).

### 4.3 Table of Contents

- **FR-011**: Each feature/subsystem page MUST display a table of contents (ToC) derived from the page's heading hierarchy (`#`, `##`, `###`).
- **FR-012**: The ToC MUST be sticky (remain visible while scrolling) on desktop viewports.
- **FR-013**: The ToC MUST highlight the currently visible section (scroll-spy behavior).
- **FR-014**: ToC items MUST be clickable and scroll to the corresponding section.
- **FR-015**: On mobile, the ToC MAY be collapsible or moved to a dropdown to save space.

### 4.4 Breadcrumbs

- **FR-016**: Each feature page MUST display breadcrumbs showing the path from home to the current page (e.g., Home > Authentication > Login).
- **FR-017**: Breadcrumb segments MUST be clickable links to their respective pages.
- **FR-018**: The current page MUST be shown as the last segment (non-clickable or styled differently).

### 4.5 Search

- **FR-019**: The wiki MUST provide full-text search across all wiki pages (title, headings, body content).
- **FR-020**: Search MUST be client-side for MVP (no backend search service required).
- **FR-021**: Search results MUST display: page title, feature path, and a snippet with highlighted search terms.
- **FR-022**: Search MUST be accessible via keyboard shortcut (e.g., `/` or `Cmd+K` / `Ctrl+K`).
- **FR-023**: Search results MUST be navigable via keyboard (arrow keys, Enter to select).
- **FR-024**: The search modal/panel MUST be dismissible via `Esc`.
- **FR-025**: Search SHOULD support fuzzy or partial matching for typo tolerance (e.g., "auth" matches "authentication").

### 4.6 Code Citations

- **FR-026**: Inline citations (links to GitHub source) MUST be visually distinguishable (e.g., inline link with icon, "View source" badge, or subtle styling).
- **FR-027**: Citation links MUST open in a new tab (`target="_blank"`) with `rel="noopener noreferrer"`.
- **FR-028**: Citation links MUST use the correct GitHub blob URL format: `https://github.com/{owner}/{repo}/blob/{branch}/{path}#L{start}-L{end}`.
- **FR-029**: Hovering over a citation SHOULD show a tooltip with file path and line range (e.g., `src/auth/login.ts:42-58`).
- **FR-030**: Citations MUST feel seamless—clicking should feel instant; no jarring transitions.

### 4.7 Code Blocks

- **FR-031**: Code blocks MUST have syntax highlighting based on the language tag (e.g., ` ```typescript `).
- **FR-032**: Each code block MUST have a copy-to-clipboard button.
- **FR-033**: The copy button MUST provide feedback on success (e.g., "Copied!" tooltip or icon change).
- **FR-034**: Code blocks MUST use a monospace font and appropriate line height for readability.
- **FR-035**: Long code blocks SHOULD have horizontal scroll rather than wrapping; line numbers are optional for MVP.

### 4.8 Theming & Responsiveness

- **FR-036**: The wiki MUST support dark mode and light mode.
- **FR-037**: Dark mode MUST be the default for the wiki (developer tool convention).
- **FR-038**: The theme preference MUST persist across sessions (e.g., `localStorage`).
- **FR-039**: The wiki MUST be fully responsive: usable on viewports from 320px (mobile) to 1920px+ (desktop).
- **FR-040**: Layout MUST adapt: sidebar collapses to overlay/drawer on mobile; ToC may collapse; typography scales appropriately.

### 4.9 Generation Flow UX

- **FR-041**: When a user submits a GitHub repo URL, the UI MUST show a loading state with a clear message (e.g., "Analyzing repository...", "Generating wiki...").
- **FR-042**: The loading state SHOULD indicate progress stages where possible (e.g., "Fetching repo" → "Analyzing" → "Classifying features" → "Generating content").
- **FR-043**: For long-running generation (>30s), the UI SHOULD display an estimated time or progress indicator (e.g., "Typically 2–5 minutes for repos of this size").
- **FR-044**: The user MUST be able to stay on the generation page or navigate away; if they leave, they SHOULD be able to return to check status (e.g., via URL with job ID, or polling).
- **FR-045**: When generation completes successfully, the UI MUST redirect or transition to the wiki home page.
- **FR-046**: When generation fails, the UI MUST display a clear error message with the reason (e.g., "Repository is private", "Rate limited—try again in an hour", "Analysis failed: unsupported language").
- **FR-047**: Failed generation MUST offer a retry action (e.g., "Try again" button).
- **FR-048**: Partial failures (e.g., some features failed) SHOULD be surfaced (e.g., banner: "Wiki generated with 2 features missing due to errors").

### 4.10 Keyboard Navigation

- **FR-049**: `/` (or `Cmd+K` / `Ctrl+K`) MUST open search focus.
- **FR-050**: `Esc` MUST close modals, search panel, and overlay sidebar.
- **FR-051**: Tab order MUST be logical and follow visual flow.
- **FR-052**: Focus MUST be trapped within modals when open (accessibility).

### 4.11 Related Features

- **FR-053**: Each feature page MUST display a "Related features" section or sidebar with links to related feature pages (from generator output).
- **FR-054**: Related feature links MUST be clearly styled and navigable.

## 5. Non-Functional Requirements (with NFR-xxx IDs)

- **NFR-001**: Page transitions (navigation between wiki pages) MUST feel instant (<100ms perceived); use client-side routing and prefetching where applicable.
- **NFR-002**: Search results MUST appear within 200ms for client-side search on typical wikis (<50 pages).
- **NFR-003**: The wiki MUST be server-rendered or statically generated where possible for fast initial load and SEO.
- **NFR-004**: The UI MUST meet WCAG 2.1 Level AA for accessibility (contrast, focus indicators, screen reader support).
- **NFR-005**: The wiki MUST work without JavaScript for critical content (progressive enhancement: core content readable, search/interactivity enhanced).
- **NFR-006**: No layout shift (CLS) during page load; reserve space for dynamic content.
- **NFR-007**: Typography MUST be optimized for long-form reading (line length 60–80 characters, comfortable line height).

## 6. UI/UX Requirements

### 6.1 Design Principles

- **Content-first**: UI should disappear; content should shine. Minimal chrome, maximum readability.
- **Scannable**: Headers, bullet points, code blocks must be visually distinct. Clear typography hierarchy (h1 > h2 > h3 > body > caption).
- **Contextual**: Show related information near where it's needed (related features, citations).
- **Fast**: Page transitions, search, navigation must feel instant.
- **Familiar**: Take cues from GitBook, Notion, Stripe docs, GitHub—tools developers already love.

### 6.2 Component Library

- **shadcn/ui** as the base component library.
- **Tailwind CSS** for styling.
- **Lucide React** for icons.
- **next/font** (or equivalent) for typography—Inter or a similar readable sans-serif for body; monospace for code.

### 6.3 Page Templates

**Wiki Home**

- Hero with repo name and description.
- Feature/subsystem grid or list with clear hierarchy.
- Quick search input.
- Last updated timestamp.
- Optional: language/framework badges from analysis.

**Feature/Subsystem Page**

- Breadcrumb navigation at top.
- Feature title and description.
- Sticky table of contents (sidebar or inline).
- Content sections with proper heading hierarchy.
- Inline code citations with visual distinction.
- Related features section or sidebar.
- Code blocks with syntax highlighting and copy button.

**Search Results**

- Instant search with keyboard shortcut.
- Results grouped by feature/subsystem or flat list with feature path.
- Highlighted search terms in snippets.
- Optional: recent searches (localStorage).

### 6.4 UI Review Checklist

- [ ] Responsive across breakpoints (mobile, tablet, desktop)
- [ ] Dark mode support (default)
- [ ] Keyboard navigation works (`/`, `Esc`, Tab)
- [ ] Loading states for generation and async operations
- [ ] Error states are user-friendly with actionable next steps
- [ ] Empty states guide the user (e.g., "No wiki yet—generate one")
- [ ] Typography hierarchy is clear
- [ ] Code blocks have syntax highlighting and copy button
- [ ] Links to source code open in new tab
- [ ] Search is accessible and fast

## 7. Technical Considerations

### 7.1 Tech Stack Alignment

- **Next.js 15** (App Router) for routing, SSR/SSG, and API routes.
- **React Server Components** where beneficial for initial load.
- **Client-side routing** for wiki page navigation (instant transitions).
- **Markdown rendering**: Use a library such as `react-markdown` with `rehype-raw` for HTML, `remark-gfm` for GitHub Flavored Markdown, and `rehype-highlight` or `rehype-prism` for syntax highlighting.

### 7.2 Data Flow

- Wiki content is produced by the generator as markdown files with frontmatter.
- Content may be stored in a database, file system, or Vercel Blob depending on architecture.
- The UI fetches wiki metadata (feature tree, page list) and page content via API routes or static generation.
- Search index: Build a client-side search index from wiki content at load time (e.g., FlexSearch, MiniSearch, or simple in-memory index). For MVP, full-text over in-memory JSON is acceptable.

### 7.3 Citation Rendering

- Citations in markdown are standard links: `[text](https://github.com/...)`.
- Custom component for link rendering: detect GitHub blob URLs, add `target="_blank"`, `rel="noopener noreferrer"`, and optional icon.
- Tooltip: use `title` attribute or a proper tooltip component for file path on hover.

### 7.4 Generation Status

- Generation is a long-running process (API route or background job).
- Options: (a) Polling—client polls status endpoint every N seconds; (b) Server-Sent Events (SSE) for real-time progress; (c) WebSocket. Recommendation: Polling for MVP simplicity; SSE for better UX in M2.
- Job ID: When user submits URL, create a job; return job ID. User can bookmark or share URL with job ID to check status later.

### 7.5 Package Boundaries

- Wiki UI lives in `apps/web`.
- It consumes: (a) generated wiki content (markdown + metadata), (b) feature tree structure, (c) repo metadata.
- It MUST NOT contain generator, analyzer, or classifier logic—only presentation and navigation.
- Shared types from `packages/shared` for wiki page schema, feature tree, etc.

### 7.6 URL Structure

- `/` or `/wiki` — wiki home (or app home with "Generate wiki" CTA if none exists).
- `/wiki/[repoId]` or `/w/[owner]/[repo]` — wiki home for a specific repo.
- `/wiki/[repoId]/[featureSlug]` or `/w/[owner]/[repo]/[featureSlug]` — feature page.
- Nested features: `/wiki/[repoId]/[parentSlug]/[childSlug]` or flat slugs with hierarchy in metadata.
- Generation: `/generate` or `/wiki/new` — URL input and generation flow.
- Generation status: `/generate/[jobId]` — status page for in-progress or completed job.

## 8. Dependencies

- **Wiki Content Generation**: The UI REQUIRES generated markdown content and feature tree from the generator. See `wiki-content-generation-prd.md`.
- **Feature Classification**: Sidebar structure comes from the classified feature tree. See `feature-classification-subsystem-detection-prd.md`.
- **Repository Ingestion**: Repo metadata (owner, name, branch) comes from ingestion. See `repository-ingestion-discovery-prd.md`.
- **Shared types**: `packages/shared` MUST define `WikiPage`, `FeatureTree`, `Citation` (or equivalent) for the UI to consume.
- **Markdown rendering**: Dependency on `react-markdown`, `rehype-*`, `remark-*` for parsing and syntax highlighting.
- **Search**: Client-side search library (e.g., FlexSearch, MiniSearch) or custom implementation.

## 9. Success Metrics

- **Time to first content**: User lands on wiki home and sees meaningful content within 2 seconds (p95).
- **Navigation efficiency**: Users can reach any feature page in ≤3 clicks from home.
- **Search effectiveness**: 80%+ of test search queries return relevant results in top 5 (manual audit of 20 queries).
- **Citation usage**: 30%+ of wiki page views include at least one citation click (indicates citations are discoverable and useful).
- **Mobile usability**: 90%+ of core flows (navigate, read, search) completable on 375px viewport without frustration (user testing).
- **Accessibility**: Lighthouse accessibility score ≥90; passes axe-core with no critical issues.
- **Generation UX**: 80%+ of users who start generation complete the flow (don't abandon during wait); NPS for "generation experience" ≥0.
- **Dark mode adoption**: Track theme preference; expect 70%+ dark mode for developer audience.

## 10. Out of Scope

- **User editing**: Generated wiki is read-only; no in-place editing or user contributions.
- **Version history / diff**: No tracking of wiki versions over time; each generation overwrites.
- **Backend search**: MVP uses client-side search only; Algolia, Meilisearch, or similar are future work.
- **Real-time collaboration**: No multi-user editing or presence.
- **Custom branding**: Fixed WikiSmith branding; white-label or custom themes are future work.
- **Offline support**: No PWA or offline caching for MVP.
- **Localization (i18n)**: English only for MVP.
- **Comments or annotations**: No user comments on wiki pages.
- **Export**: No PDF or Markdown export of wiki (future enhancement).
- **Embedded diagrams**: Mermaid or other diagram rendering may be in generator scope; rendering support is in scope, authoring is not.

## 11. Open Questions

- **OQ-1**: What is the canonical URL structure for wikis? `/w/owner/repo` vs `/wiki?repo=owner/repo` vs slug-based IDs?
- **OQ-2**: Should the generation flow be a separate "wizard" or integrated into the main app flow (e.g., home page has input, then transitions)?
- **OQ-3**: For client-side search, what's the max wiki size we need to support? 50 pages? 200? Affects index strategy.
- **OQ-4**: Should we support deep linking to specific headings (e.g., `#overview` fragment)? Improves shareability.
- **OQ-5**: How do we handle wikis for the same repo at different commits? Separate URLs or version selector?
- **OQ-6**: Should the sidebar remember expansion state per-user (localStorage) or reset on each visit?
- **OQ-7**: For generation progress: polling interval, max wait time before "this is taking longer than usual" message?
- **OQ-8**: Do we need a "Compare with GitHub" or "View on GitHub" global link in the header?

## Implementation Status

> Last updated: 2026-02-26

### What's Implemented

- Homepage with repo URL input, feature cards
- SSE streaming progress: ingesting → analyzing → classifying → generating (with page counts)
- Progress bar and stage labels during generation
- Error display with retry button
- Wiki page: sidebar + content area
- Sidebar shows feature hierarchy with active state highlighting
- Markdown rendering with react-markdown + remark-gfm
- Dark mode (default)
- Citations section at bottom of pages
- Breadcrumbs: partial (header shows WikiSmith / owner/repo, not full breadcrumb trail)

### What's Not Yet Implemented

- Table of Contents (ToC)
- Search (Cmd+K)
- Scroll-spy
- Breadcrumbs per feature
- Syntax highlighting
- Code block copy button
- Responsive mobile sidebar (hamburger)
- Light mode toggle
- Keyboard navigation

### Current Limitations

- Breadcrumbs show only WikiSmith / owner/repo, not full feature path. No ToC or search yet.
- In-session wiki navigation still exhibits hard-reload behavior in places; transitions are not consistently SPA-smooth.
- Sidebar/UI state continuity is incomplete (expansion/scroll/persistent active context).
- Visual quality and theme consistency need a dedicated polish pass across wiki + dashboard surfaces.
- Dashboard account navigation does not yet provide a clear, always-available sign-out affordance.

### Rebaseline Note

- A dedicated remediation plan is tracked in `features/wiki-ui-ux-polish-prd.md` to address navigation stability, app-shell UX, theme consistency, and visual polish before additional feature expansion.

## 12. Milestones

### M1: Core Layout & Navigation (MVP)

- FR-001, FR-002, FR-003, FR-004, FR-005 (home page)
- FR-006, FR-007, FR-008, FR-009 (sidebar)
- FR-011, FR-012, FR-014 (ToC basic)
- FR-016, FR-017, FR-018 (breadcrumbs)
- FR-036, FR-037, FR-038, FR-039, FR-040 (dark mode, responsive)
- FR-053, FR-054 (related features)
- NFR-001, NFR-003, NFR-006

**Deliverable**: Wiki home and feature pages with sidebar, breadcrumbs, ToC; dark mode; responsive. Content renders from fixture/generated markdown.

### M2: Search & Code Experience

- FR-019, FR-020, FR-021, FR-022, FR-023, FR-024, FR-025 (search)
- FR-026, FR-027, FR-028, FR-029, FR-030 (citations)
- FR-031, FR-032, FR-033, FR-034, FR-035 (code blocks)
- FR-049, FR-050, FR-051, FR-052 (keyboard nav)
- NFR-002, NFR-004

**Deliverable**: Client-side search with `/` shortcut; citations styled and functional; code blocks with syntax highlighting and copy; keyboard navigation.

### M3: Generation Flow UX

- FR-041, FR-042, FR-043, FR-044 (loading states)
- FR-045, FR-046, FR-047, FR-048 (success/error handling)
- URL input, job creation, status polling
- Error message mapping from pipeline failures

**Deliverable**: End-to-end flow from URL input to wiki view; clear loading and error states; retry on failure.

### M4: Polish & Accessibility

- FR-010 (sidebar state persistence)
- FR-013 (scroll-spy ToC)
- FR-015 (mobile ToC)
- NFR-004, NFR-005, NFR-007
- UI review checklist complete
- Lighthouse and axe audit

**Deliverable**: Production-ready wiki UI; accessible; polished; documented.
