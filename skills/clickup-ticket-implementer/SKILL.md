---
name: clickup-ticket-implementer
description: Implement a ClickUp ticket end-to-end for WikiSmith: read ticket and PRD, implement with tests, run/fix local cubic review until clean, create PR, iterate on CI and review comments until clean, and close out ClickUp after merge.
---

# ClickUp Ticket Implementer

## Role

You execute a WikiSmith ClickUp ticket from intake to merge-ready completion with strict validation and feedback loops.

## Inputs

- Preferred: full ClickUp task URL (for example `https://app.clickup.com/t/86c8xxxx`).
- Also supported: raw task ID (`86c8xxxx`) from user message or recent context.

## Behavior

1. **Read project conventions first**
   - Read `AGENTS.md` before making changes.

2. **Resolve ticket from context or user input**
   - If a ClickUp URL is present, extract task ID.
   - If only an ID is present, use it directly.
   - Fetch task details via ClickUp MCP (`clickup_get_task`).

3. **Understand requirements fully before coding**
   - Parse task name, description, acceptance criteria, dependencies, and linked context.
   - If the ticket references PRD files (usually under `features/*.md`), read those PRDs before implementing.
   - Treat PRD requirements as source of truth unless the ticket explicitly overrides them.

4. **Set task to active state**
   - Attempt to set status to `in progress` when that status exists in the list/workspace.
   - If `in progress` does not exist (WikiSmith commonly uses `to do` and `complete` only), add a start comment using `clickup_create_task_comment` explaining work has started and on which branch.

5. **Implement the ticket completely**
   - Create a branch using repo naming conventions (`feat/...`, `fix/...`, etc.).
   - Implement all required backend/frontend/data-contract changes.
   - Ensure ownership, auth, and error paths match project conventions.
   - Add or update tests to cover acceptance criteria (unit/integration/E2E as appropriate).

6. **Local quality loop (must be clean before PR)**
   - Run relevant lint, type-check, and tests.
   - Run `cubic review` locally.
   - Fix issues found by cubic.
   - Re-run `cubic review`.
   - Repeat until local cubic reports no issues.

7. **Create PR and validate CI**
   - Commit with Conventional Commits.
   - Push branch and create PR with clear summary + validation steps.
   - Wait for all required pipelines/checks to become green.

8. **Review feedback loop (no unresolved comments)**
   - Collect PR review comments/threads.
   - Fix valid issues, reply/resolve threads, and push updates.
   - Re-run local lint/type-check/tests and `cubic review` after each change batch.
   - Wait for CI checks again.
   - Repeat until:
     - required checks are green, and
     - there are no unresolved actionable review comments/threads.

9. **Closeout after merge**
   - If human merges PR: reflect completion in ClickUp with PR link + key outcomes.
   - If explicitly asked to merge: merge PR first, then reflect completion.
   - Set task status to `complete`.

## Required Validation Checklist

- [ ] Acceptance criteria implemented
- [ ] Tests added/updated for new behavior
- [ ] Local lint/type-check/tests pass
- [ ] Local `cubic review` reports no issues
- [ ] PR created with summary and validation notes
- [ ] CI checks green
- [ ] All review comments addressed/resolved
- [ ] ClickUp updated with progress and completion

## ClickUp Notes for WikiSmith

- WikiSmith often uses only `to do` and `complete` statuses.
- When `in progress` is unavailable, use a start comment as the in-progress signal.
