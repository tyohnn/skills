import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import { validatePlanning } from './planning-validation.ts';

function write(root: string, path: string, contents: string): void {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
}

function document(frontmatter: string): string {
  return `---\n${frontmatter.trim()}\n---\n`;
}

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'oh-my-docs-planning-'));
  write(
    root,
    'planning/prds/prd-one.mdx',
    document('title: One\nid: PRD-one\nstatus: active\nstories: [US-one]'),
  );
  write(root, 'planning/prds/meta.json', '{"pages":["prd-one"]}\n');
  write(root, 'planning/stories/us-one.mdx', document('title: One\nid: US-one'));
  write(root, 'planning/stories/meta.json', '{"pages":["us-one"]}\n');
  write(root, 'spec/spec-one.mdx', document('title: One\nid: SPEC-one\nstage: accepted'));
  write(root, 'spec/meta.json', '{"pages":["spec-one"]}\n');
  write(root, 'adr/adr-one.mdx', document('title: One\nid: ADR-one\nstage: accepted'));
  write(root, 'adr/meta.json', '{"pages":["adr-one"]}\n');
  write(
    root,
    'plans/plan-one.mdx',
    document(`
title: One
id: PLAN-one
stage: ready
changeType: product
prd: PRD-one
specs: [SPEC-one]
stories: [US-one]
codeAreas: [apps/example]
`),
  );
  write(root, 'plans/meta.json', '{"pages":["plan-one"]}\n');
  return root;
}

test('accepts a complete product planning graph', () => {
  const root = fixture();
  try {
    assert.deepEqual(validatePlanning(root), []);
  } finally {
    rmSync(root, { recursive: true });
  }
});

test('reports duplicate IDs and missing references', () => {
  const root = fixture();
  try {
    write(root, 'planning/stories/us-two.mdx', document('title: Two\nid: US-one'));
    write(root, 'planning/stories/meta.json', '{"pages":["us-one"]}\n');
    write(
      root,
      'plans/plan-one.mdx',
      document(`
title: One
id: PLAN-one
stage: ready
changeType: product
prd: PRD-missing
specs: [SPEC-one]
stories: [US-one]
codeAreas: [apps/example]
`),
    );
    const problems = validatePlanning(root);
    assert.ok(problems.some((p) => p.includes('duplicate id')));
    assert.ok(problems.some((p) => p.includes('PRD-missing')));
    assert.ok(problems.some((p) => p.includes('us-two') && p.includes('meta.json')));
  } finally {
    rmSync(root, { recursive: true });
  }
});

test('rejects invalid lifecycle states and missing plan codeAreas', () => {
  const root = fixture();
  try {
    write(
      root,
      'planning/prds/prd-one.mdx',
      document('title: One\nid: PRD-one\nstatus: reviewing\nstories: [US-one]'),
    );
    write(
      root,
      'plans/plan-one.mdx',
      document(`
title: One
id: PLAN-one
stage: shipping
changeType: product
prd: PRD-one
specs: [SPEC-one]
stories: [US-one]
`),
    );
    const problems = validatePlanning(root).join('\n');
    assert.match(problems, /PRD status must be draft, active, or done/);
    assert.match(problems, /plan stage must be draft, ready, active, done, or superseded/);
    assert.match(problems, /plan must declare at least one codeAreas entry/);
  } finally {
    rmSync(root, { recursive: true });
  }
});

test('allows draft maintenance plans without product references', () => {
  const root = fixture();
  try {
    write(
      root,
      'plans/plan-one.mdx',
      document(`
title: One
id: PLAN-one
stage: draft
changeType: maintenance
codeAreas: [packages/core]
`),
    );
    assert.deepEqual(validatePlanning(root), []);
  } finally {
    rmSync(root, { recursive: true });
  }
});

test('rejects ready plans that reference draft prerequisites', () => {
  const root = fixture();
  try {
    write(
      root,
      'planning/prds/prd-one.mdx',
      document('title: One\nid: PRD-one\nstatus: draft\nstories: [US-one]'),
    );
    write(root, 'spec/spec-one.mdx', document('title: One\nid: SPEC-one\nstage: draft'));
    const problems = validatePlanning(root).join('\n');
    assert.match(problems, /references draft PRD PRD-one/);
    assert.match(problems, /requires accepted spec SPEC-one/);
  } finally {
    rmSync(root, { recursive: true });
  }
});
