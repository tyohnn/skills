<!-- oh-my-docs:start -->
# Oh My Docs

This repository uses a docs-first workflow. Canonical product intent lives in
**one** handbook SSOT — either local docs (`docs/content/docs` or
`apps/docs/content/docs`) or Notion — never both as authoritative.

## Content source (SSOT)

1. Read `.omd/project.json` and use `contentSource.ssot` (`local` | `notion`).
2. Missing `contentSource` means `local`.
3. If `.omd/project.json` is missing, run `inspect` / ask the user to choose
   SSOT and `adopt` before inventing handbook files.
4. For `notion`, edit the mapped Notion handbook (via the host Notion MCP).
   For `local`, edit the docs content tree. Do not treat the other side as truth.

## Documentation is always first

Any decision, agreement, requirement, design choice, open question, or new
discussion that should outlive this chat must be written into the selected SSOT
— not left only in conversation.

1. Before and during the talk, check whether the topic already exists in the SSOT.
2. Create or update the matching handbook artifacts as the discussion progresses.
3. Catalog entries (PRD, story, plan, ADR, …) go in the **catalog store** — a
   Notion inline database row or a local catalog folder + `meta.json` — never as
   ad-hoc child pages of the parent section. **Planning ≠ Plans**: implementation
   plans belong in Plans (`dbs.plans`), not under Planning.
4. Prefer `node <skill>/scripts/omd.mjs new <kind> --title "…" --yes` (local)
   or the Notion catalog workflow (notion) over ad-hoc files or chat-only notes.
5. Run `node <skill>/scripts/omd.mjs check` after meaningful documentation edits.

## Docs-first gate

1. Classify the change as `product`, `bugfix`, `maintenance`, or docs-only.
2. Product changes require an active PRD, a story, an accepted specification, and a ready plan.
3. Bug fixes require an existing PRD/specification and a ready plan.
4. Maintenance requires a ready plan; add a specification if an observable contract changes.
5. If required documents are missing, create and review a docs-only change first.
6. An implementation PR must reference a plan that already exists on the PR base with `stage: ready|active` and covering `codeAreas`.
7. Docs-only edits under the docs content/templates trees (plus root `README.md` / `CHANGELOG.md`) are exempt. There is no general bypass.

Dependency direction:

`product vision → PRD → story → specification/ADR → implementation plan → code`
<!-- oh-my-docs:end -->

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
  `pnpm test`. The workspace is `packages: ["."]`, so the root package (named
  `skills`) is itself a turbo package whose `build`/`dev`/`typecheck`/`test`
  scripts each call `turbo run <task>` → **infinite self-recursion** that hangs.
  There is currently no real per-package TypeScript/build output (skills are
  `.mjs`/`.md`/`.yaml`), so these tasks have nothing to do anyway.
- **Dev workflow = the node scripts** (see `README.md`):
  `pnpm skills:verify` (`node scripts/verify-all.mjs`), `pnpm test:skills`
  (`node --test shared/runtime/*.test.mjs`), `node scripts/create-skill.mjs`,
  `node scripts/emit-skill-md.mjs --all`, `node scripts/install-deps.mjs`,
  `node scripts/sync-skill-runtime.mjs`.
- **Content SSOT is Notion** (`.omd/project.json`), not a local docs app; there
  is no `docs/` app or `@oh-my-docs/ui` package in this repo.
