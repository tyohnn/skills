# tyohnn/skills

Monorepo for agent skills. Canonical skill folders live under `skills/<slug>/`.

**Dependency truth is `skill.yaml`.** Install execution always goes through
`npx skills add …` (and package managers for non-skill packages). skills.sh does
not read `skill.yaml`; our scripts translate it.

## Layout

```text
skills/                 # flat skill folders
shared/
  schemas/              # skill.yaml JSON Schema
  runtime/              # install / emit / validate core
scripts/
  install-deps.mjs
  emit-skill-md.mjs
  verify-all.mjs
  create-skill.mjs
  sync-skill-runtime.mjs
```

Seed skills: `holiday-cfo`, `holiday`, `img2threejs`, `concept-to-threejs`.

Out of repo (external deps only): `oh-my-docs`, `chartcn`. Out of scope: `3d-game-dev`.

## Commands

```bash
pnpm install
node scripts/verify-all.mjs
node scripts/install-deps.mjs --all          # or --skill <name>
node scripts/emit-skill-md.mjs --all         # skill.yaml → SKILL.md Install block
node scripts/create-skill.mjs --name my-skill --kind utility
node scripts/sync-skill-runtime.mjs          # copy runtime into each skill
pnpm test:skills
```

## Consumer install

```bash
npx skills add tyohnn/skills --skill concept-to-threejs -y
node <install-path>/concept-to-threejs/scripts/ensure-deps.mjs
```

Sibling skills also install via `npx skills add tyohnn/skills --skill <name> -y`
(same path whether you are inside this monorepo or not; a full checkout is
effectively a no-op when the folder already exists).

## Planning

Content SSOT is Notion (see `.omd/project.json`). Agents use the `oh-my-doc`
skill for docs-first checks.
