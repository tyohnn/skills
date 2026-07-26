# Notion information architecture

Path: `skills/oh-my-doc/references/` (name **`references`**, not `ref`).

Machine-readable companion: `notion-ia-graph.json` (`schemaVersion` 1.2).

Catalog destinations are **pages** that embed their database **inline**. The
navigable object is the page; the database is not a top-level sidebar target.

## Home + sources toggle

The URL passed to `adopt --ssot notion --notion-root …` is **Home**
(`pages.home`). Do not create a separate handbook-root or sources child page.

Managed top-level pages are Notion children of Home, nested inside a
`<details>` toggle titled **데이터 원본** (`toggles.sources`, kind `toggle`).
Strategy id: `home-details-toggle`.

```text
Home (user-supplied URL → pages.home)
├── sidebar chrome + body
└── <details> 데이터 원본 </details>
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
    │   ├── System model (page → inline DB)
    │   └── CLI
    ├── Plans (page → inline DB)
    └── ADRs (page → inline DB)
```

Never materialize **데이터 원본** as its own page. If a host turns toggle-nested
pages into a parent page, treat that as a bug in provisioning — rewrite Home
content so the toggle remains a `<details>` block.

Sidebar navigation uses page mentions only — never bare URLs as the primary nav.
Every `pages.*` object must receive the shared sidebar chrome.
