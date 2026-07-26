---
name: holiday
description: "Equity and industry analysis skill. Uses chartcn for charting surfaces; chartcn stays an external package, not a vendored copy."
---
## Install

<!-- skill-install:start -->

```bash
# generated — do not hand-edit; run: node scripts/emit-skill-md.mjs --skill holiday
# packages (also installed by ensure-deps)
# github:tyohnn/chartcn
node scripts/ensure-deps.mjs
```

<!-- skill-install:end -->
<!-- skill-body:start -->

## When to use

- Equity or industry analysis that needs structured research and charts.
- Charting should use external `chartcn` (never vendor a copy into this repo).

## Procedure

1. Run `node scripts/ensure-deps.mjs` to install `chartcn` into the consumer project.
2. Gather tickers, time range, and the decision the analysis should support.
3. Produce analysis notes and charts via chartcn.
4. State assumptions, uncertainties, and next checks explicitly.

<!-- skill-body:end -->
