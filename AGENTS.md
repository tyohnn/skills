<!-- oh-my-docs:start -->
# Oh My Docs

This repository uses a docs-first workflow. Canonical product intent lives in
**one** handbook SSOT — either local docs (`docs/content/docs` or
`apps/docs/content/docs`) or Notion — never more than one as authoritative.

## Content source (SSOT)

1. Read `.omd/project.json` and use `contentSource.ssot`
   (`local` | `notion`).
2. Missing `contentSource` means `local`.
3. If `.omd/project.json` is missing, run `inspect` / ask the user to choose
   SSOT and `adopt` before inventing handbook files.
4. For `local`, edit the Fumadocs MDX tree. For `notion`, edit the single
   Home page: only `# 도메인` / `# 기획` / `# 개발` section headers, with
   catalog DBs stacked inline under them (no per-catalog headings, no child
   pages, no sidebar) via the host Notion MCP. Do not treat an unselected
   provider as truth.

## Documentation is always first

Any decision, agreement, requirement, design choice, open question, or new
discussion that should outlive this chat must be written into the selected SSOT
— not left only in conversation.

1. Before and during the talk, check whether the topic already exists in the SSOT.
2. Create or update the matching handbook artifacts as the discussion progresses.
3. Catalog entries (PRD, story, plan, ADR, …) go in the **catalog store** — a
   Notion inline database row on Home, or a local catalog folder +
   `meta.json` — never as ad-hoc child pages. **Planning ≠ Plans**:
   implementation plans belong in Plans (`dbs.plans`).
4. Prefer `node <skill>/scripts/omd.mjs new <kind> --title "…" --yes` (local)
   or the Notion catalog workflow (notion) over ad-hoc files or chat-only notes.
5. Run `node <skill>/scripts/omd.mjs check` after meaningful documentation edits.
<!-- oh-my-docs:end -->

## Korean output

한국어로 답변·PR·커밋·README·설계 메모·리뷰 코멘트를 쓸 때는
`skills/natural-korean`을 기본으로 따른다. 장르가 아니라 말투다 —
단정하지 말고, 이어서 말하고, 평소에 쓸 단어만 쓴다.

## Cursor Cloud specific instructions

This is a pnpm + Node monorepo of agent skills. The "app" is the CLI tooling in
`scripts/` + `shared/runtime/`; there is no web server. See `README.md` for the
canonical command list.

- **Node version**: `package.json` requires Node `>=24`. The VM's nvm default is
  Node 24 and interactive shells prefer it via a one-time `~/.bashrc` edit,
  because the daemon's bundled `/exec-daemon/node` (v22) would otherwise win in
  `PATH`. `node -v` should report v24.x; if it reports v22, the shell did not
  pick up nvm's default.
- **Do NOT run the turbo tasks** `pnpm build`, `pnpm dev`, `pnpm typecheck`, or
  `pnpm test`. The root package is still named `skills` and its `build`/`dev`/`typecheck`/`test`
  scripts call `turbo run <task>` → **infinite self-recursion** if invoked at
  the root. Prefer filtered package scripts (`pnpm --filter docs …`) or the
  skill node scripts below. Skill packages themselves remain `.mjs`/`.md`/`.yaml`.
- **Dev workflow = the node scripts** (see `README.md`):
  `pnpm skills:verify` (`node scripts/verify-all.mjs`), `pnpm test:skills`
  (`node --test shared/runtime/*.test.mjs`), `node scripts/create-skill.mjs`,
  `node scripts/emit-skill-md.mjs --all`, `node scripts/install-deps.mjs`,
  `node scripts/sync-skill-runtime.mjs`.
- **Content SSOT is Notion** (`.omd/project.json` →
  `https://app.notion.com/p/paxhumana/tyohnn-skills-3a9346dac4568024802cf881896d3bd3`).
  Handbook catalogs live as inline DBs on that Home page (도메인 / 기획 / 개발).
  Mutate via Notion MCP; do not treat local `docs/` or Supabase as handbook truth.
- Root turbo tasks (`pnpm build` / `dev` / `typecheck` / `test`) still recurse on
  the root `skills` package — do not run them. Use the skill node scripts below
  for the monorepo tooling.
