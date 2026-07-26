# Oh My Docs

This repository uses a docs-first workflow. Canonical product intent lives under
`docs/content/docs` (or `apps/docs/content/docs` when present).

## Docs-first gate

1. Classify the change as `product`, `bugfix`, `maintenance`, or docs-only.
2. Product changes require an active PRD, a story, an accepted specification, and a ready plan.
3. Bug fixes require an existing PRD/specification and a ready plan.
4. Maintenance requires a ready plan; add a specification if an observable contract changes.
5. If required documents are missing, create and review a docs-only change first.
6. An implementation PR must reference a plan that already exists on the PR base with `stage: ready|active` and covering `codeAreas`.
7. Docs-only edits under the docs content/templates trees (plus root `README.md` / `CHANGELOG.md`) are exempt. There is no general bypass.

Dependency direction:

`product vision → PRD → story → specification/ADR → implementation plan → code`

Create drafts with `node <skill>/scripts/omd.mjs new <kind> --title "…" --yes`.
Run `node <skill>/scripts/omd.mjs check` before opening an implementation PR.

> Managed by Oh My Docs (`adopt` / `sync`). Prefer re-running the skill runtime over hand-editing this body.
