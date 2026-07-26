import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

import { parseFrontmatter } from '../runtime/frontmatter.mjs';
import { inspectProject } from '../runtime/inspect.mjs';
import { adoptProject } from '../runtime/adopt.mjs';
import { validatePlanning } from '../runtime/planning.mjs';
import { gateScriptExistsOnBase, validateDocsFirst } from '../runtime/docs-first.mjs';

const skillRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const templateRoot = join(skillRoot, 'templates/default');
const schemasDir = join(skillRoot, 'schemas');

test('frontmatter parses scalars and block arrays', () => {
  const data = parseFrontmatter(
    `---\ntitle: Hello\nstories:\n  - US-one\n  - US-two\nspecs: [SPEC-a, SPEC-b]\n---\n\nBody\n`,
    'sample.mdx',
  );
  assert.equal(data.title, 'Hello');
  assert.deepEqual(data.stories, ['US-one', 'US-two']);
  assert.deepEqual(data.specs, ['SPEC-a', 'SPEC-b']);
});

test('inspect classifies empty directory as greenfield', () => {
  const root = mkdtempSync(join(tmpdir(), 'omd-inspect-'));
  try {
    const report = inspectProject({ cwd: root });
    assert.equal(report.mode, 'greenfield');
    assert.equal(report.omd.present, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('adopt greenfield writes .omd and docs skeleton', () => {
  const root = mkdtempSync(join(tmpdir(), 'omd-adopt-'));
  try {
    const result = adoptProject({
      cwd: root,
      templateRoot,
      skillRoot,
      schemasDir,
      force: true,
    });
    assert.equal(result.mode, 'greenfield');
    assert.ok(existsSync(join(root, '.omd/project.json')));
    assert.ok(existsSync(join(root, '.omd/state.json')));
    assert.ok(existsSync(join(root, 'docs/content/docs/meta.json')));
    const meta = JSON.parse(readFileSync(join(root, 'docs/content/docs/meta.json'), 'utf8'));
    assert.deepEqual(meta.pages, [
      'index',
      'vision',
      'starting',
      'workflow',
      'planning',
      'plans',
      'adr',
      'spec',
    ]);
    assert.equal(result.contract.ui.base, 'fumadocs');
    assert.equal(result.contract.ui.distribution, 'skill-template');
    assert.ok(result.contract.ui.shellDependencies.includes('fumadocs-ui'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('docs-first bootstrap ignores legacy TypeScript gate paths', () => {
  const files = new Map([
    ['scripts/check-docs-first.ts', 'legacy'],
    ['packages/core/src/docs-first.ts', 'legacy'],
  ]);
  const readBaseFile = (path) => {
    if (!files.has(path)) throw new Error(`missing ${path}`);
    return files.get(path);
  };
  assert.equal(gateScriptExistsOnBase(readBaseFile), false);
  assert.deepEqual(
    validateDocsFirst({
      prBody: '',
      changedPaths: ['skills/oh-my-doc/runtime/docs-first.mjs'],
      readBaseFile,
    }),
    [],
  );
});

test('docs-first enforces when skill-era gate exists on base', () => {
  const files = new Map([
    ['scripts/check-docs-first.mjs', 'gate'],
  ]);
  const readBaseFile = (path) => {
    if (!files.has(path)) throw new Error(`missing ${path}`);
    return files.get(path);
  };
  assert.equal(gateScriptExistsOnBase(readBaseFile), true);
  assert.match(
    validateDocsFirst({
      prBody: '',
      changedPaths: ['skills/oh-my-doc/runtime/docs-first.mjs'],
      readBaseFile,
    })[0] ?? '',
    /Plan:/,
  );
});

test('planning validator accepts ADR locked stage', () => {
  const root = mkdtempSync(join(tmpdir(), 'omd-plan-'));
  const adrDir = join(root, 'adr');
  mkdirSync(adrDir, { recursive: true });
  writeFileSync(
    join(adrDir, 'meta.json'),
    `${JSON.stringify({ pages: ['index', 'adr-lock'] }, null, 2)}\n`,
  );
  writeFileSync(join(adrDir, 'index.mdx'), '---\ntitle: ADR index\n---\n');
  writeFileSync(
    join(adrDir, 'adr-lock.mdx'),
    `---\ntitle: Lock\nid: ADR-lock\nstage: locked\n---\n\nBody\n`,
  );
  const problems = validatePlanning(root);
  assert.deepEqual(problems, []);
  rmSync(root, { recursive: true, force: true });
});
