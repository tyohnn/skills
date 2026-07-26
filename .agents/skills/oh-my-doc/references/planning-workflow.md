# Planning workflow

1. Classify the change (`product`, `bugfix`, `maintenance`, or docs-only).
2. Discover candidate user stories. Moderate unresolved decisions one at a
   time and record only agreed outcomes. `grill-me` is optional.
3. Group accepted stories into a change-scoped PRD. Product PRDs record
   `reviewStatus: moderated` and the moderation method.
4. Design the approved target state in dependency order:
   Domain terms/models/policies → living SPECs → ADRs → change-scoped PLAN.
5. Reuse stable living IDs. SPECs are organized by durable contract boundary,
   not recreated as one integrated spec per initiative.
6. Create drafts with
   `node <skill>/scripts/omd.mjs new prd|story|spec|plan|adr --title "…" --yes`
   (or copy docs templates). Register each catalog document in sibling
   `meta.json`.
7. Set readiness:
   - PRD: `status: active`
   - Story: `stage: accepted`
   - Specification: `stage: accepted`
   - PLAN: `stage: ready` (or `active` during implementation), with `codeAreas`
8. Review and merge planning separately from code. After approval, derive
   dependency-aware `.omd` tasks from the PLAN.
9. Validate with `omd.mjs check` / `pnpm check:planning`, and
   `pnpm check:docs-first` on implementation PRs.
