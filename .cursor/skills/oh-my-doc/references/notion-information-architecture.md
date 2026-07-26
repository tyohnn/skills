# Notion information architecture

Path: `skills/oh-my-doc/references/` (name **`references`**, not `ref`).

Machine-readable companion: `notion-ia-graph.json` (`schemaVersion` 1.1).

Catalog destinations are **pages** that embed their database **inline**. The
navigable object is the page; the database is not a top-level sidebar target.

## Sources parenting

Managed top-level pages are parented under a real page titled **데이터 원본**
(`toggles.sources`). Nesting `<page>` children inside a root `<details>` toggle
materializes that parent page in Notion MCP — treat it as the canonical model
(`sourcesStrategy: sources-page-parent`).

```text
Handbook root (user supplied)
├── 데이터 원본 (sources page)
│   ├── Home
│   ├── Vision
│   ├── Start here
│   ├── Workflow
│   │   ├── Workflow Planning
│   │   └── Development
│   ├── Domain
│   │   ├── Glossary (page → inline DB)
│   │   ├── Models (page → inline DB)
│   │   └── Policies (page → inline DB)
│   ├── Planning
│   │   ├── PRDs (page → inline DB)
│   │   └── Stories (page → inline DB)
│   ├── Spec
│   │   ├── Data model (page → inline DB)
│   │   ├── System model (page → inline DB)
│   │   └── CLI
│   ├── Plans (page → inline DB)
│   └── ADRs (page → inline DB)
└── (optional root details listing the same children)
```

Sidebar navigation uses page mentions only — never bare URLs as the primary nav.
Every `pages.*` object must receive the shared sidebar chrome.
