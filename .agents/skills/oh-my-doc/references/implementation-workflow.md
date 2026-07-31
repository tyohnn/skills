# Implementation workflow

1. Ship code. Handbook catalogs are ordinary docs, not a merge prerequisite.
2. Write or update PRD / story / SPEC / ADR / plan pages only when you want
   durable notes in the SSOT.
3. If scope or observable behavior changes in a way that should outlive chat,
   update the matching handbook artifacts as you go.
4. Run the project's verification steps (`pnpm test`, `pnpm typecheck`,
   `omdocs check` / `omd.mjs check`, and any plan-local checks you wrote).
5. Prefer CLI and project scripts over ad hoc checks.

There is no `Plan:` trailer, ready-plan-on-base requirement, or
`check:docs-first` gate.
