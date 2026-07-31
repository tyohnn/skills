# Planning workflow

0. Read `.omd/project.json` `contentSource.ssot` (`local` | `notion`). Missing
   means `local`. Documentation is always first: any decision, agreement, or new
   discussion that should outlive chat must be written into that SSOT.
1. Use handbook catalogs (PRD, story, SPEC, ADR, plan) when durable notes help.
   They are ordinary docs — not a required sequence before code.
2. Discover candidate user stories. Moderate unresolved decisions one at a
   time and record only agreed outcomes. `grill-me` is optional.
3. Group related stories into a change-scoped PRD when useful.
4. Design the target state in dependency order when the change needs it:
   Domain terms/models/policies → living SPECs → ADRs → change-scoped PLAN.
5. Reuse stable living IDs. SPECs are organized by durable contract boundary,
   not recreated as one integrated spec per initiative.
6. Create drafts with
   `node <skill>/scripts/omd.mjs new prd|story|spec|plan|adr --title "…" --yes`
   (or copy docs templates). Register each catalog document in sibling
   `meta.json`.
7. Prefer updating a stable ID over duplicating. Validate with `omd.mjs check`
   / `pnpm check:planning` when you touch planning catalogs.
