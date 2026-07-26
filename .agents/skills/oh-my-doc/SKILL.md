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

Read `.omd/project.json` `contentSource.ssot` (`local` | `notion`) before choosing a
workflow. Missing `contentSource` means `local`. Documentation is always first:
any decision, agreement, or new discussion that should outlive chat must be
written into that SSOT.

### State machine

1. `inspect` — classify greenfield vs brownfield; never mutate.
2. **Ask SSOT** — before the first adopt, ask the user to choose `local`
   (Fumadocs docs app) or `notion`. Greenfield `adopt` without `--ssot` fails
   with `needsSsot`.
3. `adopt --ssot local --dry-run` / `--yes` — scaffold docs + `packages/docs-ui`,
   write `.omd/`.
4. `adopt --ssot notion --notion-root …` — map root to `pages.home`, emit a
   Notion MCP provisioning manifest from `references/notion-*` (never a `ref/`
   path); execute via host MCP; record mappings. Does **not** install local UI.
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
| `references/planning-workflow.md` | How to plan before code |
| `references/implementation-workflow.md` | How to implement under a ready plan |
| `references/document-contracts.md` | Frontmatter, IDs, and catalog rules |
| `references/agent-compatibility.md` | Host discovery paths |
| `references/notion-information-architecture.md` | Notion page + details-toggle IA |
| `references/notion-sidebar.md` | Shared sidebar callout / double-layer chrome |
| `references/notion-page-templates.md` | Notion-flavored body templates |
| `references/notion-manual-checklist.md` | Host-only steps (page Full width) |
| `references/notion-ia-graph.json` | Machine-readable Notion object graph |
| `references/notion-catalog-schemas.json` | Catalog DB properties and relations |
| `assets/AGENTS.md` / `assets/CLAUDE.md` | Marker body templates |

## Hard rules

- Never invent product requirements from code alone.
- Never skip the docs-first gate for product, bugfix, or maintenance work.
- Always read `.omd/project.json` `contentSource.ssot` and treat that provider as
  the only handbook SSOT; ask + `adopt` when `.omd` is missing.
- Documentation is always first: write decisions, agreements, and new discussions
  into the SSOT instead of leaving truth only in chat.
- Catalog entries (PRD, story, plan, ADR, …) go in the catalog store (Notion
  inline DB or local catalog folder + `meta.json`), never as ad-hoc section
  children. **Planning ≠ Plans**: implementation plans belong in Plans
  (`dbs.plans`), not under Planning.
- Never hand-edit managed `<!-- oh-my-docs:* -->` marker blocks; run `sync` or `adopt`.
- Never auto-reorder brownfield IA on first adopt.
- Prefer `inspect → ask SSOT → adopt → check` over inventing handbook files.
