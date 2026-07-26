# Information architecture

Generated and maintained handbooks use a stable top-level IA:

| Section | Role |
|---|---|
| Home | Handbook landing page |
| Vision | Product vision |
| Start here | Single page — shortest path into the product |
| Domain | Living terms, models, and policies |
| Workflow | Planning and development contracts |
| Planning | PRD and story catalogs (index-only) |
| Plans | Implementation plans (index-only catalog) |
| ADR | Architecture decisions (index-only catalog) |
| Spec | Living contract pages (children visible) |

Default order:

`Home → Vision → Start here → Domain → Workflow → Planning → Plans → ADR → Spec`

There is no default **Development** or **Agent** section. IA is editable later
via `.omd/project.json` and `sync`.

Domain contains:

- `glossary/` (`TERM-*`)
- `models/` (`MODEL-*`)
- `policies/` (`POLICY-*`)

Domain and Spec are living surfaces. PRDs and PLANs remain change-scoped
catalogs, ADRs remain decision records, and `.omd/tasks` is execution state.

Catalog folders (`domain/glossary`, `domain/models`, `domain/policies`,
`planning/prds`, `planning/stories`, `plans`, `adr`, `spec/data-model`,
`spec/system-model`) stay index-only in the sidebar. Each document is registered
in its sibling `meta.json`. Domain’s sidebar shows Glossary, Models, and
Policies; Spec’s sidebar shows the boundary entries (`data-model`,
`system-model`, `cli`). Those catalogs hide detail pages the same way PRDs do.

Browser pages expose a processed Markdown twin at the same URL with `.md`
appended so agents can read the identical SSOT without scraping HTML.
