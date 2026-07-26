# Implementation workflow

1. Confirm a plan already exists on the PR base with `stage: ready|active`.
2. Reference it in the change description:
   `Plan: <path-to-plan.mdx>`
3. Keep edits inside the plan's `codeAreas` unless you first update and review
   the plan.
4. If scope or observable behavior changes, return to planning before more code.
5. Run the plan's verification steps, then mark the plan `done`.
6. Prefer CLI and project scripts (`omdocs check`, `pnpm check:docs-first`,
   `pnpm test`, `pnpm typecheck`) over ad hoc checks.

Docs-only edits under the docs content/templates trees (plus root `README.md` /
`CHANGELOG.md`) do not require a prior plan. There is no general bypass for
product, bugfix, or maintenance work.
