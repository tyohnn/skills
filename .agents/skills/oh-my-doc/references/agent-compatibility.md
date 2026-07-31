# Agent compatibility

Natural-language requests are the primary UX. Host slash commands are optional
wrappers around the same `oh-my-doc` skill.

## Discovery paths

| Host | Project path | User path |
|---|---|---|
| Cursor | `.cursor/skills/oh-my-doc` | `~/.cursor/skills/oh-my-doc` |
| Codex | `.agents/skills/oh-my-doc` | `~/.agents/skills/oh-my-doc` |
| Claude Code | `.claude/skills/oh-my-doc` | `~/.claude/skills/oh-my-doc` |

Preferred install:

```bash
npx skills add tyohnn/oh-my-docs --skill oh-my-doc -y
```

`skills add` defaults to **symlink** installs: one canonical copy (typically
under `.agents/skills/oh-my-doc` or `~/.agents/skills/oh-my-doc`) with agent
paths linking to it. Prefer `-a cursor` (or the current host) when only one
agent is needed. Avoid `--copy` unless symlinks are unsupported.

Adopt updates `AGENTS.md` / `CLAUDE.md` markers only. It must not copy the full
skill tree into all three project agent directories.

Canonical skill content lives at `skills/oh-my-doc` and is mirrored into optional
host plugin wrappers under `plugins/{cursor,codex,claude-code}/skills/oh-my-doc`.

## Runtime

Agents should call the bundled Node runtime:

```bash
node <skill>/scripts/omd.mjs inspect --json
node <skill>/scripts/omd.mjs adopt --ssot local --yes --json
node <skill>/scripts/omd.mjs adopt --ssot notion --notion-root <url-or-id> --dry-run --json
node <skill>/scripts/omd.mjs check --json
```

Before the first adopt, ask the user to choose SSOT (`local` or `notion`).
Greenfield adopt without `--ssot` fails with `needsSsot`. Options are only
`local` | `notion` — `supabase` is removed (ADR-008).

Do not tell users to run a public npm CLI. Prefer running `omd.mjs` yourself and
summarizing results in chat.
