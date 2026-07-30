# Catalog write destinations

Catalog kinds are **entries in a catalog store**, not free-form child pages of a
section.

| Kind | Notion destination | Local destination |
|---|---|---|
| PRD | Row in `dbs.prds` on **PRDs** (under Planning) | `planning/prds/` + `meta.json` |
| Story | Row in `dbs.stories` on **Stories** | `planning/stories/` + `meta.json` |
| Plan | Row in `dbs.plans` on top-level **Plans** | `plans/` + `meta.json` |
| ADR | Row in `dbs.adrs` on top-level **ADRs** | `adr/` + `meta.json` |
| Spec | Row in `dbs.data-model` / `dbs.system-model` | `spec/data-model` or `spec/system-model` |

## Do / don’t

- **Do** create implementation plans in **Plans** (`pages.plans` → `dbs.plans`).
- **Don’t** create a Plan as a child page under **Planning**.
- **Planning** only nests the PRDs and Stories catalog pages.
- **Plans** is a sibling of Planning at the handbook root (same for ADRs).

Machine map: `references/handbook-ia-graph.json` → `kindToDatabase` and each
catalog page’s `writeTarget` / `forbiddenParents`.

Runtime: `planCreateDocument` / local `omd new` target those destinations.
