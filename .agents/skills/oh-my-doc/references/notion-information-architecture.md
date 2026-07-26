# Notion information architecture

Path: `skills/oh-my-doc/references/` (name **`references`**, not `ref`).

Machine-readable companion: `notion-ia-graph.json` (`schemaVersion` 1.3).

Catalog destinations are **pages** that embed their database **inline**. The
navigable object is the page; the database is not a top-level sidebar target.

## Sources parenting

Default `sourcesStrategy` is **`details-toggle-on-home`**.

- The user-supplied Notion root **is** Home (`pages.home`, role `home`).
- **데이터 원본** is a `<details>` toggle on Home — not a child page.
- Managed top-level pages parent under Home and are listed inside that toggle.

```text
Home (user-supplied notion-root = pages.home)
├── columns (sidebar chrome + Home body)
└── <details> 데이터 원본
    ├── Vision
    ├── Start here
    ├── Workflow
    │   ├── Workflow Planning
    │   └── Development
    ├── Domain
    │   ├── Glossary (page → inline DB)
    │   ├── Models (page → inline DB)
    │   └── Policies (page → inline DB)
    ├── Planning
    │   ├── PRDs (page → inline DB)
    │   └── Stories (page → inline DB)
    ├── Spec
    │   ├── Data model (page → inline DB)
    │   └── System model (page → inline DB)
    ├── Plans (page → inline DB)
    └── ADRs (page → inline DB)
```

Do not emit `ensure_page` for a sources container titled 데이터 원본.

Sidebar navigation uses page mentions only — never bare URLs as the primary nav.
Every managed content page except Home still receives the shared sidebar chrome;
Home receives chrome plus the sources details toggle.
