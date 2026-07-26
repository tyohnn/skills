---
name: concept-to-threejs
description: "Turn a science or engineering concept into a one-page 3D learning scene by routing through img2threejs and docs-first planning via oh-my-doc."
depends:
  - img2threejs
---
## Install

<!-- skill-install:start -->

```bash
# generated — do not hand-edit; run: node scripts/emit-skill-md.mjs --skill concept-to-threejs
npx skills add tyohnn/skills --skill img2threejs -y
npx skills add ssota-labs/oh-my-docs --skill oh-my-doc -y
node scripts/ensure-deps.mjs
```

<!-- skill-install:end -->
<!-- skill-body:start -->

## When to use

- A user wants a teachable 3D scene for a science/engineering concept.
- You need a workflow that plans first (oh-my-doc) then builds visuals (img2threejs).

## Procedure

1. Run `node scripts/ensure-deps.mjs` so `img2threejs` and `oh-my-doc` are available.
2. Capture the concept, audience, and success criteria in a short plan/spec when the change is product-shaped.
3. Produce scene requirements (entities, interactions, labels) and hand off to `img2threejs`.
4. Verify the scene teaches the concept without requiring code reading.

<!-- skill-body:end -->
