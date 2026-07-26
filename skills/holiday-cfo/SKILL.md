---
name: holiday-cfo
description: "Personal and company financial accounting workflow. Composes analysis skills and keeps books, cash, and reporting decisions in one place."
depends:
  - holiday
---
## Install

<!-- skill-install:start -->

```bash
# generated — do not hand-edit; run: node scripts/emit-skill-md.mjs --skill holiday-cfo
npx skills add tyohnn/skills --skill holiday -y
node scripts/ensure-deps.mjs
```

<!-- skill-install:end -->
<!-- skill-body:start -->

## When to use

- Personal or company bookkeeping / CFO-style workflows.
- You need analysis support from `holiday` without copying that skill.

## Procedure

1. Run `node scripts/ensure-deps.mjs` to pull in `holiday`.
2. Clarify entity (personal vs company), period, and reporting outcome.
3. Use `holiday` for market/industry context when investment questions appear.
4. Keep ledgers, cash position, and decisions as explicit artifacts.

<!-- skill-body:end -->
