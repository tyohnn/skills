# Notion page body templates

Notion-flavored Markdown with placeholders. Substitute from state mappings
after databases exist.

## Stacked Home (current)

**Hard rule:** Home may use only these `#` headings, in this order:
`도메인`, `기획`, `개발`. Do **not** emit per-catalog headings
(`# Glossary`, `# PRDs`, …) — the database title is enough.

```markdown
Oh My Docs handbook (agent SSOT). Catalogs are stacked inline databases on this page — no child pages, no sidebar.

# 도메인
<database url="{{dbs.glossary}}" inline="true">Glossary</database>
<database url="{{dbs.models}}" inline="true">Models</database>
<database url="{{dbs.policies}}" inline="true">Policies</database>

# 기획
<database url="{{dbs.prds}}" inline="true">PRDs</database>
<database url="{{dbs.stories}}" inline="true">Stories</database>

# 개발
<database url="{{dbs.data-model}}" inline="true">Data model</database>
<database url="{{dbs.system-model}}" inline="true">System model</database>
<database url="{{dbs.plans}}" inline="true">Plans</database>
<database url="{{dbs.adrs}}" inline="true">ADRs</database>
```

Runtime builds this with `renderStackedHomeContent` from
`notion-ia-graph.json` → `homeStack`. `validateStackedHomeContent` hard-fails
on catalog headings, wrong section order, or sidebar chrome.
