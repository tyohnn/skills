# Document contracts

## Frontmatter expectations

Planning documents carry machine-readable frontmatter. Common fields:

| Field | Used by |
|---|---|
| `id` / `ticker` | Stable identity |
| `title`, `description`, `summary` | Human and catalog display |
| `type` | Document role (`guide`, overview, …) |
| `status` / `stage` | Lifecycle |
| `prd`, `specs`, `stories` | Graph links |
| `codeAreas` | Paths a plan authorizes |
| `related` | Handbook cross-links |
| `documentClass` | `living`, `decision`, `change`, or `execution` |
| `specType` | Stable contract boundary (`behavior`, `data-model`, `system-model`, `api`, `ui`, `security`, custom) |
| `review` | Moderation/approval metadata for product PRDs |

Lifecycle fields:

| Kind | Field | Values |
|---|---|---|
| PRD | `status` | `draft`, `active`, `done` |
| Story | `stage` | `draft`, `accepted`, `superseded` |
| Spec | `stage` | `draft`, `accepted`, `superseded` |
| ADR | `stage` | `accepted`, `locked`, `superseded` |
| Plan | `stage` | `draft`, `ready`, `active`, `done`, `superseded` |

## Domain contracts

Domain documents use stable prefixes:

| Kind | Prefix | Role |
|---|---|---|
| Term | `TERM-` | Shared meaning |
| Model | `MODEL-` | Concepts, relationships, lifecycle |
| Policy | `POLICY-` | Conditional product rule or invariant |

Specifications reference Domain IDs rather than redefining them. PRDs and PLANs
are bounded change records; Vision, stories, Domain, and SPECs are living
documents updated in place.

## Task contracts

Tasks are execution state derived after a PLAN is approved. Each task lives in
`.omd/tasks/TASK-*.json`, references exactly one PLAN, declares `dependsOn`,
`codeAreas`, and US/POLICY/SPEC acceptance IDs, and follows:

`draft → ready|blocked → active → done|failed` (or `cancelled`).

PLAN/sprint terminology is configurable presentation. Internal `PLAN-*` and
`TASK-*` identities do not change.

`node <skill>/scripts/omd.mjs check` / `pnpm check:planning` enforce titles,
kind-prefixed IDs, `meta.json` registration, PRD→story→spec→plan references,
lifecycle states, and non-empty plan `codeAreas`. Treat IDs as immutable once
published; update the existing document instead of duplicating intent.

## Marker blocks

`AGENTS.md` and `CLAUDE.md` may contain a managed block:

```html
<!-- oh-my-docs:start -->
…
<!-- oh-my-docs:end -->
```

Only `adopt` / `sync` should create or refresh that block. Surrounding project
content outside the markers is preserved.

## Skill trees

Installed skills live under host discovery paths. Refresh them with `adopt` or
`sync` (`--force` when a local copy diverged and should be replaced).
