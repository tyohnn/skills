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
npx skills add ssota-labs/oh-my-docs --skill oh-my-doc -y
```

Canonical skill content lives at `skills/oh-my-doc` and is mirrored into optional
host plugin wrappers under `plugins/{cursor,codex,claude-code}/skills/oh-my-doc`.

## Runtime

Agents should call the bundled Node runtime:

```bash
node <skill>/scripts/omd.mjs inspect --json
node <skill>/scripts/omd.mjs adopt --yes --json
node <skill>/scripts/omd.mjs check --json
```

Do not tell users to run a public npm CLI.
