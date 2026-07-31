# Notion information architecture

Path: `skills/oh-my-doc/references/` (name **`references`**, not `ref`).

Machine-readable companion: `notion-ia-graph.json` (`schemaVersion` 2.0).
Local Fumadocs still uses `handbook-ia-graph.json` (full tree).

## Agent stack (`stacked-on-home`)

Default Notion `sourcesStrategy` is **`stacked-on-home`**.

- The user-supplied Notion root **is** Home (`pages.home`, role `home`).
- **All catalog databases** are children of Home and rendered **inline**,
  stacked under section headers on that one page.
- **Only** these `#` headings are allowed on Home, in order:
  **도메인**, **기획**, **개발** (`homeStack.sections`).
- **Forbidden:** per-catalog headings (`# Glossary`, `# PRDs`, …), catalog
  child pages, Vision/Workflow pages, sidebar chrome.
- Agents read/write catalog rows in the inline DBs on Home; the DB title is
  the catalog label.

```text
Home (user-supplied notion-root = pages.home)
├── intro (short plain body, no # heading required)
├── # 도메인
│   ├── Glossary (inline DB)
│   ├── Models (inline DB)
│   └── Policies (inline DB)
├── # 기획
│   ├── PRDs (inline DB)
│   └── Stories (inline DB)
└── # 개발
    ├── Data model (inline DB)
    ├── System model (inline DB)
    ├── Plans (inline DB)
    └── ADRs (inline DB)
```

Do not emit `ensure_page` for catalog indexes. Do not emit sidebar `<columns>`
chrome for Notion SSOT. Provision/check hard-fail if Home drifts from
`homeStack`.

## Catalog write destinations

| Kind | Notion destination |
|---|---|
| PRD | Row in `dbs.prds` on Home |
| Story | Row in `dbs.stories` on Home |
| Plan | Row in `dbs.plans` on Home |
| ADR | Row in `dbs.adrs` on Home |
| Spec | Row in `dbs.data-model` / `dbs.system-model` on Home |

Machine map: `notion-ia-graph.json` → `kindToDatabase`.
