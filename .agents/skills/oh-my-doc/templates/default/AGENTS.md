# Repository instructions

<!-- oh-my-docs:start -->
# Oh My Docs

This repository uses a docs-first workflow. Canonical product intent lives under
`docs/content/docs`.

## Docs-first gate

1. Classify the change as `product`, `bugfix`, `maintenance`, or docs-only.
2. Product changes require an active PRD, a story, an accepted specification, and a ready plan.
3. Bug fixes require an existing PRD/specification and a ready plan.
4. Maintenance requires a ready plan; add a specification if an observable contract changes.
5. If required documents are missing, create and review a docs-only change first.
6. An implementation PR must reference a plan that already exists on the PR base with `stage: ready|active` and covering `codeAreas`.
7. Docs-only edits under `docs/content/docs/` or `docs/templates/` (plus root `README.md` / `CHANGELOG.md`) are exempt. There is no general bypass.

Dependency direction:

`product vision → PRD → story → specification/ADR → implementation plan → code`

Create drafts with `omdocs new <kind> --title "…"`. Run `omdocs check` before
opening an implementation PR.
<!-- oh-my-docs:end -->
