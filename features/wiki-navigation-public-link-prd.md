# Wiki Navigation Public Link — PRD

## Goal

Add a persistent navigation link to the live public wiki so users can open it directly from the app navigation bar.

## Problem Statement

Users currently need to manually copy or remember the public wiki URL. This creates friction for demos, onboarding, and quick validation of the shared wiki experience.

## User Stories

- As a user visiting WikiSmith, I want a one-click link to the live public wiki so I can view the published experience immediately.
- As a signed-in user, I want this link to stay visible in navigation so I can jump between app workflows and the public wiki.
- As a first-time visitor, I want the link label to clearly indicate it opens a live wiki page.

## Requirements

- R-001: The primary navigation bar MUST include a dedicated link item for the public wiki.
- R-002: The link URL MUST be exactly:
  - `https://wikismith.dudkin-garage.com/s/776e7126-1ef9-43a2-bf4b-1ee087851042`
- R-003: The link MUST be visible for both authenticated and unauthenticated users in nav surfaces where primary app navigation is rendered.
- R-004: The link label MUST be explicit (proposed: `Live Wiki`).
- R-005: The link MUST follow existing navigation styling conventions and remain usable on mobile and desktop.
- R-006: Keyboard navigation and focus states MUST meet existing accessibility standards.

## Technical Notes

- Add the URL as a shared constant (avoid hardcoding it in multiple components).
- Update the top-level navigation component(s), including the home page navigation area and any shared app-shell navigation used across authenticated views.
- Reuse existing button/link styles from the design system (`Button` + `Link`) to keep visual consistency.
- Add/adjust UI tests for nav presence and destination where coverage already exists.

## Success Metrics

- SM-001: 100% of primary nav renders include the `Live Wiki` link.
- SM-002: Link destination is correct in manual QA and automated checks.
- SM-003: No accessibility regressions in nav keyboard flow.

## Out of Scope

- Dynamic per-repository public wiki links.
- Role-based visibility for the nav link.
- Link analytics/dashboard reporting.

## Open Questions

- OQ-001: Should the link open in the same tab or a new tab by default?
- OQ-002: Should the nav label be `Live Wiki`, `Public Wiki`, or `Example Wiki`?
