---
name: oh-my-doc
description: Install and run Oh My Docs — docs-first planning for coding agents. Use when the user asks to set up Oh My Docs, adopt an existing repo, create PRD/story/spec/plan/ADR docs, check the planning graph, or sync handbook IA. Prefer natural language; call the bundled Node runtime instead of inventing files by hand.
---

# Oh My Docs

Users do not run a public CLI. You (the agent) install this skill and drive the
bundled runtime.

## Install (first time)

```bash
npx skills add tyohnn/oh-my-docs --skill oh-my-doc -y
```

`skills add` defaults to **symlinks** (one canonical copy). Prefer
`-a <host>` when only one agent is needed. Avoid `--copy` unless symlinks are
unsupported. Do not re-copy the skill into every agent directory during adopt.

## Runtime actions

Always prefer JSON for machine steps:

```bash
node <skill>/scripts/omd.mjs inspect --json
node <skill>/scripts/omd.mjs adopt --ssot local --yes --json
node <skill>/scripts/omd.mjs adopt --ssot notion --notion-root <url-or-id> --dry-run --json
node <skill>/scripts/omd.mjs new prd --title "…" --yes --json
node <skill>/scripts/omd.mjs check --json
node <skill>/scripts/omd.mjs sync --yes --json
```

Read `.omd/project.json` `contentSource.ssot` (`local` | `notion`) before
choosing a workflow. Missing `contentSource` means `local`. Documentation is
always first: any decision, agreement, or new discussion that should outlive
chat must be written into that SSOT.

### State machine

1. `inspect` — classify greenfield vs brownfield; never mutate.
2. **Ask SSOT** — before the first adopt, ask the user to choose `local`
   (Fumadocs MDX tree) or `notion` (one Home page with stacked inline catalog
   DBs — no child pages/sidebar). Greenfield
   `adopt` without `--ssot` fails with `needsSsot`.
3. `adopt --ssot local --dry-run` / `--yes` — scaffold docs + `packages/docs-ui`,
   write `.omd/`.
4. `adopt --ssot notion --notion-root …` — map root to `pages.home`, emit a
   Notion MCP provisioning manifest from `references/notion-*` (never a `ref/`
   path); execute via host MCP; record mappings. Does **not** install local UI.
   Notion IA is one Home page: section headers **도메인 / 기획 / 개발** only,
   with stacked inline catalog DBs under them (no per-catalog `#` headings).
5. `check` — validate planning graph + `.omd` contract + UI vocabulary (local),
   or Notion root/mappings/pending ops (notion).
6. `new` / `sync` as needed for later work.

## UI distribution

- Docs shell base is **Fumadocs**. Install `fumadocs-ui` / `fumadocs-core` /
  `fumadocs-mdx` via npm as normal peer dependencies (local SSOT only).
- Planning vocabulary (`DocKind`, `Decision`, …) lives in the skill template and
  is **copied into `packages/docs-ui` by local `adopt`**. There is no shadcn
  registry.
- Keep dogfood `packages/docs-ui` and
  `skills/oh-my-doc/templates/default/packages/docs-ui` in sync.

## Progressive disclosure

| File | When to read |
|---|---|
| `references/methodology.md` | Product intent and docs-first principles |
| `references/information-architecture.md` | Handbook section layout |
| `references/planning-workflow.md` | How to use handbook catalogs when useful |
| `references/implementation-workflow.md` | How to implement alongside ordinary docs |
| `references/document-contracts.md` | Frontmatter, IDs, and catalog rules |
| `references/agent-compatibility.md` | Host discovery paths |
| `references/notion-information-architecture.md` | Notion Home stack (도메인/기획/개발) |
| `references/notion-catalog-writes.md` | Where PRD/story/plan/ADR rows go (Planning ≠ Plans) |
| `references/notion-sidebar.md` | Notion chrome (section headers only; no sidebar) |
| `references/notion-page-templates.md` | Notion-flavored body templates |
| `references/notion-manual-checklist.md` | Host-only steps (page Full width) |
| `references/handbook-ia-graph.json` | Shared structure metadata IA graph (local + Notion) |
| `references/notion-catalog-schemas.json` | Catalog DB properties and relations |
| `assets/AGENTS.md` / `assets/CLAUDE.md` | Marker body templates |

## Hard rules

- Never invent product requirements from code alone.
- Always read `.omd/project.json` `contentSource.ssot` (`local` | `notion`) and
  treat that provider as the only handbook **content** SSOT; structure metadata
  comes from the shared IA graph stamped into `.omd/project.json`. Ask + `adopt`
  when `.omd` is missing.
- Documentation is always first: write decisions, agreements, and new discussions
  into the SSOT instead of leaving truth only in chat.
- Catalog entries (PRD, story, plan, ADR, …) go in the catalog store (Notion
  inline DB or local catalog folder + `meta.json`), never as ad-hoc section
  children. **Planning ≠ Plans**: implementation plans belong in Plans
  (`dbs.plans`), not under Planning.
- **Notion `OMD ID`:** catalog property type is Notion `UNIQUE_ID` (auto).
  Never invent slug IDs or write the property on create/update.
- **Notion Home body (mandatory when `ssot: notion`):**
  - Exactly three `#` headings, in order: `도메인`, `기획`, `개발`.
  - Never emit per-catalog headings (`# Glossary`, `# Models`, `# PRDs`, …);
    the database title is the catalog label.
  - Never add sidebar chrome, Vision/Workflow child pages, or catalog index pages.
  - Follow `references/notion-ia-graph.json` → `homeStack`. Runtime
    `validateStackedHomeContent` / provision chrome validation **hard-fail** on
    drift — do not “fix” by adding headings.
- Never hand-edit managed `<!-- oh-my-docs:* -->` marker blocks; run `sync` or `adopt`.
- Never auto-reorder brownfield IA on first adopt.
- Prefer `inspect → ask SSOT → adopt → check` over inventing handbook files.
