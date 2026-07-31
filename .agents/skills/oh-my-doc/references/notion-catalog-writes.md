# Catalog write destinations

Catalog kinds are **entries in a catalog store**, not free-form child pages of a
section.

| Kind | Notion destination | Local destination |
|---|---|---|
| PRD | Row in `dbs.prds` on **Home** | `planning/prds/` + `meta.json` |
| Story | Row in `dbs.stories` on **Home** | `planning/stories/` + `meta.json` |
| Plan | Row in `dbs.plans` on **Home** | `plans/` + `meta.json` |
| ADR | Row in `dbs.adrs` on **Home** | `adr/` + `meta.json` |
| Spec | Row in `dbs.data-model` / `dbs.system-model` on **Home** | `spec/data-model` or `spec/system-model` |

## Do / don’t

- **Do** create catalog rows in the inline DBs stacked on Notion Home.
- **Don’t** create catalog child pages or sidebar nav for Notion SSOT.
- **Don’t** create a Plan as a free-form page outside `dbs.plans`.
- **Don’t** set `OMD ID` when creating a Notion row. It is a Notion
  `UNIQUE_ID` column (auto-generated; prefixes like `PRD`, `US`, `PLAN`).
  Title + optional Summary/Status only.

Machine map: `references/notion-ia-graph.json` → `kindToDatabase` (Notion);
`handbook-ia-graph.json` for local.

Runtime: `planCreateDocument` / local `omd new` target those destinations.
Local MDX still uses slug-style frontmatter `id`; Notion SSOT does not.
