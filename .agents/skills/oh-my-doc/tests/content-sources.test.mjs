import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { adoptProject } from '../runtime/adopt.mjs';
import { createContentSource, normalizeContentSource } from '../runtime/omd-contract.mjs';
import { parseNotionRoot } from '../runtime/content-sources/notion-root.mjs';
import {
  planProvision,
  planCreateDocument,
  recordResult,
  validateSnapshot,
  validateMapping,
  capabilityBlockers,
} from '../runtime/content-sources/notion.mjs';
import { adoptNotionProject } from '../runtime/content-sources/adopt-notion.mjs';
import { loadNotionReferences } from '../runtime/content-sources/load-references.mjs';

const skillRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const templateRoot = join(skillRoot, 'templates/default');
const schemasDir = join(skillRoot, 'schemas');
const dogfoodRoot = '3a7346da-c456-800a-85f4-cae724925f98';

test('references Notion templates load stacked-on-home IA', () => {
  const refs = loadNotionReferences(skillRoot);
  assert.equal(refs.iaGraph.schemaVersion, '2.0');
  assert.equal(refs.iaGraph.sourcesStrategy, 'stacked-on-home');
  assert.equal(refs.iaGraph.sourcesToggle, undefined);
  assert.deepEqual(refs.iaGraph.nav.topLevel, ['pages.home']);
  assert.deepEqual(refs.iaGraph.nav.nested, {});
  assert.ok(!refs.iaGraph.objects.some((o) => o.key === 'pages.vision'));
  assert.ok(!refs.iaGraph.objects.some((o) => o.key === 'pages.glossary'));
  assert.ok(!refs.iaGraph.objects.some((o) => o.key === 'pages.prds'));
  assert.ok(
    refs.iaGraph.objects.some(
      (o) => o.key === 'pages.home' && o.role === 'home' && o.suppliedAsRoot === true,
    ),
  );
  assert.ok(
    refs.iaGraph.objects.some(
      (o) => o.key === 'dbs.prds' && o.parent === 'pages.home' && o.inline === true,
    ),
  );
  assert.ok(
    refs.iaGraph.objects.some(
      (o) => o.key === 'dbs.plans' && o.parent === 'pages.home' && o.inline === true,
    ),
  );
  assert.ok(refs.iaGraph.kindToDatabase?.plan === 'dbs.plans');
  assert.ok(refs.catalogSchemas.schemas.plans.relations.some((r) => r.from === 'Specs (System model)'));
  assert.match(refs.sidebar, /stacked-on-home|no sidebar/i);
  assert.match(refs.manualChecklist, /Full width/);
});

test('parseNotionRoot accepts dashed id and URL', () => {
  const fromId = parseNotionRoot(dogfoodRoot);
  assert.equal(fromId.rootPageId, dogfoodRoot);
  const fromUrl = parseNotionRoot(
    `https://www.notion.so/oh-my-doc-${dogfoodRoot.replaceAll('-', '')}`,
  );
  assert.equal(fromUrl.rootPageId, dogfoodRoot);
});

test('createContentSource and normalize reject supabase', () => {
  assert.throws(() => createContentSource(/** @type {any} */ ('supabase')), /supabase.*removed/i);
  assert.throws(
    () => normalizeContentSource({ contentSource: { ssot: 'supabase' } }),
    /supabase.*removed/i,
  );
  assert.equal(createContentSource('local').ssot, 'local');
});

test('local adopt writes explicit contentSource.local and packages/docs-ui', () => {
  const root = mkdtempSync(join(tmpdir(), 'omd-local-ssot-'));
  try {
    const result = adoptProject({
      cwd: root,
      templateRoot,
      skillRoot,
      schemasDir,
      force: true,
    });
    assert.equal(result.contract.contentSource.ssot, 'local');
    assert.equal(result.contract.paths.ui, 'packages/docs-ui');
    assert.ok(existsSync(join(root, 'packages/docs-ui/package.json')));
    assert.equal(existsSync(join(root, 'packages/ui')), false);
    assert.equal(existsSync(join(root, '.cursor/skills/oh-my-doc/SKILL.md')), false);
    assert.equal(existsSync(join(root, '.agents/skills/oh-my-doc/SKILL.md')), false);
    const project = JSON.parse(readFileSync(join(root, '.omd/project.json'), 'utf8'));
    assert.equal(normalizeContentSource(project).ssot, 'local');
    assert.equal(normalizeContentSource({}).ssot, 'local');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('notion planProvision uses stacked-on-home agent layout', () => {
  const first = planProvision({ skillRoot, notionRoot: dogfoodRoot });
  const second = planProvision({ skillRoot, notionRoot: dogfoodRoot });
  assert.equal(first.manifestDigest, second.manifestDigest);
  assert.equal(first.manifest.sourcesStrategy, 'stacked-on-home');
  assert.ok(first.manifest.operations.length > 10);
  assert.ok(
    !first.manifest.operations.some((op) => op.op === 'write_root_sources_index'),
  );
  assert.ok(!first.manifest.operations.some((op) => op.op === 'ensure_page'));
  const mapHome = first.manifest.operations.find((op) => op.op === 'map_supplied_root');
  assert.ok(mapHome);
  assert.equal(mapHome.key, 'pages.home');

  const bodyOps = first.manifest.operations.filter((op) => op.op === 'write_page_body');
  assert.equal(bodyOps.length, 1);
  const homeBody = bodyOps.find((op) => op.key === 'pages.home');
  assert.ok(homeBody);
  assert.equal(homeBody.payload.template, 'stacked-on-home');
  assert.doesNotMatch(String(homeBody.payload.content), /<columns>/);
  assert.doesNotMatch(String(homeBody.payload.content), /<details>/);
  assert.match(String(homeBody.payload.content), /<database\b[^>]*inline="true"/);

  const ensureOps = first.manifest.operations.filter(
    (op) => op.op === 'ensure_database' || op.op === 'map_supplied_root',
  );
  const results = ensureOps.map((op) => ({
    operationId: op.id,
    status: /** @type {'completed'} */ ('completed'),
    object: {
      key: op.key,
      id: op.op === 'map_supplied_root' ? dogfoodRoot : `id-${op.key}`,
      type: op.op === 'ensure_database' ? 'database' : 'page',
      parentKey: op.expectedParentKey,
    },
  }));
  const provider = recordResult({
    manifest: first.manifest,
    manifestDigest: first.manifestDigest,
    results,
  });
  const replay = planProvision({
    skillRoot,
    notionRoot: dogfoodRoot,
    mappings: {
      'pages.home': {
        id: dogfoodRoot,
        type: 'page',
        parentKey: 'root',
        url: `https://www.notion.so/${dogfoodRoot.replaceAll('-', '')}`,
      },
      ...provider.notion.mappings,
    },
  });
  for (const op of replay.manifest.operations.filter(
    (o) => o.op === 'ensure_database' || o.op === 'map_supplied_root',
  )) {
    assert.equal(op.action, 'skip_or_update');
    assert.ok(op.mappedId);
  }

  const snapshot = {
    rootPageId: dogfoodRoot,
    objects: {
      'pages.home': { id: dogfoodRoot, type: 'page', parentKey: 'root' },
      ...Object.fromEntries(
        Object.entries(provider.notion.mappings).map(([key, value]) => [key, value]),
      ),
    },
    inline: Object.fromEntries(
      first.manifest.operations
        .filter((op) => op.op === 'set_inline')
        .map((op) => [op.key, true]),
    ),
    chrome: { 'pages.home': true },
  };
  const validation = validateSnapshot({ manifest: first.manifest, snapshot });
  assert.equal(validation.ok, true);
});

test('validateMapping rejects wrong type/parent', () => {
  const ok = validateMapping({
    key: 'dbs.prds',
    mapping: { id: 'abc', type: 'database', parentKey: 'pages.home' },
    expectedType: 'database',
    expectedParentKey: 'pages.home',
  });
  assert.equal(ok.ok, true);
  const bad = validateMapping({
    key: 'dbs.prds',
    mapping: { id: 'abc', type: 'page', parentKey: 'root' },
    expectedType: 'database',
    expectedParentKey: 'pages.home',
  });
  assert.equal(bad.ok, false);
  assert.ok(bad.problems.some((p) => p.code === 'mapping_conflict'));
});

test('capabilityBlockers report missing MCP and auth', () => {
  const blockers = capabilityBlockers({ mcpAvailable: false, authenticated: false });
  assert.deepEqual(
    blockers.map((b) => b.code).sort(),
    ['authentication_required', 'capability_missing'],
  );
});

test('adoptNotion dry-run returns manifest without writing', () => {
  const root = mkdtempSync(join(tmpdir(), 'omd-notion-adopt-'));
  try {
    const result = adoptNotionProject({
      cwd: root,
      skillRoot,
      schemasDir,
      notionRoot: dogfoodRoot,
      dryRun: true,
    });
    assert.equal(result.dryRun, true);
    assert.equal(result.contentSource.ssot, 'notion');
    assert.ok(result.manifest.operations.length > 0);
    assert.equal(result.contract.ui.distribution, 'none');
    assert.equal(existsSync(join(root, '.omd/project.json')), false);
    assert.equal(existsSync(join(root, 'packages/docs-ui')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('adoptNotion --yes writes contract with pages.home mapping and no UI scaffold', () => {
  const root = mkdtempSync(join(tmpdir(), 'omd-notion-write-'));
  try {
    const result = adoptNotionProject({
      cwd: root,
      skillRoot,
      schemasDir,
      notionRoot: `https://www.notion.so/${dogfoodRoot.replaceAll('-', '')}`,
      dryRun: false,
    });
    assert.equal(result.ok, true);
    assert.ok(existsSync(join(root, '.omd/project.json')));
    assert.equal(existsSync(join(root, 'packages/docs-ui')), false);
    assert.equal(existsSync(join(root, 'docs')), false);
    const project = JSON.parse(readFileSync(join(root, '.omd/project.json'), 'utf8'));
    assert.equal(project.contentSource.ssot, 'notion');
    assert.equal(project.contentSource.notion.rootPageId, dogfoodRoot);
    assert.equal(project.ui.distribution, 'none');
    assert.ok(project.informationArchitecture.graphDigest);
    assert.equal(project.informationArchitecture.kindToDatabase.plan, 'dbs.plans');
    const state = JSON.parse(readFileSync(join(root, '.omd/state.json'), 'utf8'));
    assert.equal(state.provider.notion.mappings['pages.home'].id, dogfoodRoot);
    assert.ok(state.provider.notion.pendingOperationIds.length > 0);
    assert.ok(!state.provider.notion.pendingOperationIds.includes('ensure:pages.home'));
    const agents = readFileSync(join(root, 'AGENTS.md'), 'utf8');
    assert.match(agents, /contentSource\.ssot/);
    assert.match(agents, /Documentation is always first/);
    assert.match(agents, /<!-- oh-my-docs:start -->/);
    assert.match(agents, /Planning ≠ Plans|dbs\.plans/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('planCreateDocument targets dbs.plans for plan kind', () => {
  const planned = planCreateDocument({
    skillRoot,
    kind: 'plan',
    title: 'Example plan',
  });
  assert.equal(planned.ok, true);
  assert.equal(planned.operation.key, 'dbs.plans');
  assert.equal(planned.operation.payload.databaseKey, 'dbs.plans');
  assert.equal(planned.operation.expectedParentKey, 'dbs.plans');
  assert.equal(planned.operation.payload.autoIdProperty, 'OMD ID');
  assert.equal(planned.operation.payload.properties.Title, 'Example plan');
  assert.equal(planned.operation.payload.omdId, undefined);

  const prd = planCreateDocument({
    skillRoot,
    kind: 'prd',
    title: 'Example PRD',
  });
  assert.equal(prd.operation.key, 'dbs.prds');
});

test('catalog OMD ID is unique_id with kind prefixes', () => {
  const refs = loadNotionReferences(skillRoot);
  assert.equal(refs.catalogSchemas.schemaVersion, '1.1');
  for (const schema of Object.values(refs.catalogSchemas.schemas)) {
    const omd = schema.properties.find((p) => p.name === 'OMD ID');
    assert.ok(omd, 'OMD ID property required');
    assert.equal(omd.type, 'unique_id');
    assert.ok(omd.prefix, 'unique_id prefix required');
  }
  assert.equal(refs.catalogSchemas.schemas.prds.properties.find((p) => p.name === 'OMD ID').prefix, 'PRD');
  assert.equal(refs.catalogSchemas.schemas.plans.properties.find((p) => p.name === 'OMD ID').prefix, 'PLAN');
});
