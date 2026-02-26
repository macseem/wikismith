# Wiki UI/UX Polish & Navigation Stability — PRD

## 1. Goal

Ship a cohesive, production-grade WikiSmith experience by fixing navigation behavior, state continuity, app-shell usability, and visual quality across wiki and dashboard surfaces.

## 2. Problem Statement

Current user feedback highlights critical UX gaps that reduce trust and usability:

- Wiki page navigation causes full page reload behavior instead of smooth client-side transitions.
- Wiki UI state is not preserved well (active item context, sidebar continuity, perceived app state).
- Visual design is functionally correct but lacks polish and readability hierarchy expected from a docs product.
- Dashboard navigation lacks a clear, persistent account action model (including obvious sign-out access).
- Theme behavior is inconsistent across pages/components.

These issues make the app feel unfinished, even when core backend functionality works. A dedicated polish pass is required before adding more advanced features.

## 3. User Stories

- As a developer reading a wiki, I want instant in-app page transitions so that browsing feels smooth and focused.
- As a developer, I want sidebar/navigation state to persist while exploring pages so that I keep context.
- As a user, I want a visually polished reading experience with clear hierarchy so that long docs are comfortable to consume.
- As a user, I want consistent theming across dashboard and wiki so that the product feels coherent.
- As an authenticated user, I want an always-accessible account menu with sign-out so that I can safely end sessions.
- As a mobile user, I want navigation and account actions to remain usable on small screens.

## 4. Functional Requirements

### 4.1 Wiki Client Navigation

- FR-001: Wiki page-to-page navigation MUST use client-side routing (`Link`-driven transitions) and MUST NOT trigger full document reload.
- FR-002: Wiki sidebar interactions MUST preserve SPA navigation behavior for parent/child nodes.
- FR-003: Navigating to a new wiki page MUST keep persistent layout regions (header/sidebar shell) mounted where feasible.
- FR-004: Wiki transitions SHOULD include subtle motion feedback (active highlight transition and content fade) without reducing readability.

### 4.2 Wiki State Management

- FR-005: Sidebar expansion/collapse state MUST persist during navigation.
- FR-006: Active-page highlighting MUST update reliably on route change.
- FR-007: Sidebar scroll position SHOULD be retained when navigating between pages in the same repo wiki.
- FR-008: Wiki-level UI state (loading/error/empty and selected page context) MUST be modeled explicitly in a reusable state container or hook.

### 4.3 Visual Redesign for Wiki Reading Surface

- FR-009: Wiki layout MUST be refreshed with an intentional docs-style visual system (typography scale, spacing rhythm, readable line length).
- FR-010: Sidebar, top bar, content container, and page headings MUST follow a consistent hierarchy and visual language.
- FR-011: Markdown rendering styles MUST improve readability for headings, paragraphs, lists, code, blockquotes, and tables.
- FR-012: Code blocks MUST have improved presentation (contrast, spacing, overflow behavior, and copy affordance alignment with design system).

### 4.4 App Shell and Account Navigation

- FR-013: Dashboard and wiki MUST share a consistent global app-shell pattern (header structure, branding, nav affordances).
- FR-014: Authenticated surfaces MUST include a visible user menu with actions: Dashboard, Settings, Sign out.
- FR-015: Sign-out MUST be reachable in <=2 clicks from dashboard and wiki pages.
- FR-016: App-shell navigation MUST be responsive, including mobile-safe menu behavior.

### 4.5 Theme Consistency

- FR-017: Theme tokens (color, typography, border, elevation) MUST be centralized and reused by wiki and dashboard components.
- FR-018: Theme switching behavior (if toggle is exposed) MUST apply consistently across all pages without partial mismatches.
- FR-019: Components MUST not hardcode one-off colors that bypass the token system.
- FR-020: Theme preference MUST persist between sessions for authenticated and unauthenticated wiki views.

### 4.6 UX Quality & Accessibility

- FR-021: Keyboard focus indicators MUST be visible and consistent for nav links, menus, and theme controls.
- FR-022: Interactive elements in navigation/account controls MUST be screen-reader labeled.
- FR-023: Layout and navigation MUST remain fully usable at mobile breakpoints (>=320px).
- FR-024: Empty/error states for wiki and dashboard MUST be visually clear and actionable.

## 5. Non-Functional Requirements

- NFR-001: Client-side wiki route transitions SHOULD complete within 150ms perceived latency after data is available.
- NFR-002: No full document reload for in-wiki navigation under normal operation.
- NFR-003: UI must meet WCAG 2.1 AA contrast/focus requirements for primary text and controls.
- NFR-004: UI state persistence logic MUST avoid hydration mismatches and client/server divergence.
- NFR-005: Visual update MUST keep cumulative layout shift low (no major content jumps during page load).

## 6. UI/UX Requirements

- Establish a clear docs visual identity: stronger typography rhythm, improved whitespace, and hierarchy-first layout.
- Use component-level consistency for active nav states, hover/focus styles, chips/badges, and menu surfaces.
- Introduce subtle motion only where it clarifies navigation state (avoid decorative animation overload).
- Ensure desktop and mobile behaviors are intentionally designed (not only stacked desktop layout).

## 7. Technical Considerations

- Audit all wiki navigation links to ensure `next/link` usage and avoid accidental hard reload patterns.
- Introduce a wiki UI state module (hook/store) for navigation and sidebar state persistence.
- Consolidate design tokens in shared CSS variables/Tailwind theme extensions for wiki and dashboard.
- Refactor app-shell components to avoid duplicated top-level navigation logic across routes.
- Add E2E assertions verifying no hard navigation for sidebar page changes.

## 8. Dependencies

- `features/wiki-ui-navigation-prd.md` (existing wiki UX baseline)
- `features/repository-management-prd.md` (dashboard surface and account controls)
- `features/authentication-authorization-prd.md` (sign-out behavior and session UX)

## 9. Success Metrics

- SM-001: 0 observed full-page reloads during wiki sidebar page navigation in E2E tests.
- SM-002: Wiki route-change UX rated as "smooth" in internal review (qualitative pass criteria).
- SM-003: Sign-out discoverability issue resolved (user can sign out from dashboard without dead-end).
- SM-004: Theme consistency defects across key surfaces reduced to zero in QA checklist.
- SM-005: Accessibility checks pass for navigation and account controls (no critical axe violations).

## 10. Out of Scope

- Rewriting wiki generation prompts/content quality.
- New backend RAG/Q&A features.
- Multi-tenant org permissions redesign.
- Full design system package extraction across all apps.

## 11. Open Questions

- OQ-001: Should theme toggle be exposed to anonymous wiki viewers, or only authenticated users?
- OQ-002: Should wiki sidebar state persist only per session or across sessions?
- OQ-003: Should dashboard and wiki share one identical header, or a shared base with context variants?

## 12. Milestones

### M1 — Navigation and State Reliability

- FR-001 to FR-008, FR-021, FR-024
- E2E coverage for no-reload navigation and state persistence

### M2 — Visual Polish and App Shell

- FR-009 to FR-016
- Shared account menu and sign-out reachability

### M3 — Theme Consistency and Accessibility Hardening

- FR-017 to FR-023
- Accessibility sweep and regression checklist sign-off
