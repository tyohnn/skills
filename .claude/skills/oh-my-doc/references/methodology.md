# Methodology

Oh My Docs treats the Fumadocs handbook as the single source of truth for
product intent. Code follows reviewed documents; documents are not reverse
engineered from an implementation after the fact.

## User-centered PDCA

```text
Discover → Plan → Design → Approve → Do → Check → Act
```

Discover starts from candidate user stories and moderated decisions. Plan groups
accepted stories into a change-scoped PRD. Design updates living Domain and SPEC
contracts, records ADRs, and produces a bounded PLAN. Git approval precedes
agent-generated execution tasks. Check and Act close evidence-backed gaps.

## Document lifetimes

| Class | Documents | Rule |
|---|---|---|
| Living | Vision, US, Domain, SPEC | Update stable IDs in place as approved target state changes |
| Decision | ADR | Preserve the choice and supersession history |
| Change | PRD, PLAN | Keep the bounded initiative record |
| Execution | `.omd` tasks | Track dependency-aware work in committed snapshots |

Domain provides shared terms (`TERM-*`), models (`MODEL-*`), and policies
(`POLICY-*`). SPECs reference those concepts and define observable system
guarantees by durable boundary such as behavior, data model, system model, API,
UI, or security.

## Change classes

| Class | Required planning |
|---|---|
| Product behavior | Moderated PRD, accepted story, living Domain/SPEC updates, ready PLAN |
| Bug fix | Existing PRD/specification, ready plan |
| Maintenance | Ready plan; specification if a contract changes |
| Documentation only | No prior plan |

## Agent responsibility

1. Resolve intent from the handbook and `AGENTS.md`.
2. Moderate unresolved product decisions one at a time; `grill-me` is optional,
   not required.
3. Refuse to implement when required artifacts are missing or not ready.
4. After PLAN approval, derive tasks and execute only dependency-ready,
   non-conflicting work.
5. Keep marker blocks and skills under runtime control (`adopt/sync`).
