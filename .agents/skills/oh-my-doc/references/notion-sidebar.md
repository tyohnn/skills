# Notion page chrome

## Current SSOT: section headers only, no sidebar

With `sourcesStrategy: stacked-on-home`, Notion handbooks **do not** use
sidebar columns or callout nav. Home is a single vertical stack:

1. Short intro (plain text)
2. Exactly three `#` section headers: **도메인**, **기획**, **개발**
3. Inline catalog databases under each section (DB title = catalog label)

**Hard fail** if Home has per-catalog headings (`# Glossary`, …), wrong
section order, sidebar chrome, or missing section DBs.

Runtime helpers:

- `renderStackedHomeContent` — emit Home stack from `homeStack.sections`
- `validateStackedHomeContent` — strict section/DB contract
- `validateManifestSidebarChrome` — for stacked strategy, runs the strict
  validator (not a soft “has databases” check)

## Legacy sidebar (local/human experiments only)

Older manifests used two-column sidebar chrome (`renderSidebarPageContent`,
yellow active leaf). That path remains in `sidebar.mjs` for tests/history but
is **not** emitted by Notion adopt when `stacked-on-home` is set.
