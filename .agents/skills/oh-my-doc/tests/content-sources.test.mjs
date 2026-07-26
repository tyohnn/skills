import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { adoptProject } from '../runtime/adopt.mjs';
import { normalizeContentSource } from '../runtime/omd-contract.mjs';
import { parseNotionRoot } from '../runtime/content-sources/notion-root.mjs';
import {
  planProvision,
  recordResult,
  validateSnapshot,
  validateMapping,
  capabilityBlockers,
  renderSidebarPageContent,
} from '../runtime/content-sources/notion.mjs';
import { adoptNotionProject } from '../runtime/content-sources/adopt-notion.mjs';
import { loadNotionReferences } from '../runtime/content-sources/load-references.mjs';

const skillRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const templateRoot = join(skillRoot, 'templates/default');
const schemasDir = join(skillRoot, 'schemas');
const dogfoodRoot = '3a7346da-c456-800a-85f4-cae724925f98';

test('references Notion templates load details-toggle-on-home IA', () => {
  const refs = loadNotionReferences(skillRoot);
  assert.equal(refs.iaGraph.schemaVersion, '1.3');
  assert.equal(refs.iaGraph.sourcesStrategy, 'details-toggle-on-home');
  assert.equal(refs.iaGraph.sourcesToggle.kind, 'details');
  assert.ok(!refs.iaGraph.objects.some((o) => o.key === 'toggles.sources'));
  assert.ok(
    refs.iaGraph.objects.some(
      (o) => o.key === 'pages.home' && o.role === 'home' && o.suppliedAsRoot === true,
    ),
  );
  assert.ok(refs.iaGraph.objects.some((o) => o.key === 'pages.vision' && o.parent === 'pages.home'));
  assert.ok(refs.iaGraph.objects.some((o) => o.key === 'pages.prds' && o.inlineDatabase === 'dbs.prds'));
  assert.ok(refs.catalogSchemas.schemas.plans.relations.some((r) => r.from === 'Specs (System model)'));
  assert.match(refs.sidebar, /yellow_bg/);
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

test('notion planProvision uses details toggle and no sources page ensure', () => {
  const first = planProvision({ skillRoot, notionRoot: dogfoodRoot });
  const second = planProvision({ skillRoot, notionRoot: dogfoodRoot });
  assert.equal(first.manifestDigest, second.manifestDigest);
  assert.equal(first.manifest.sourcesStrategy, 'details-toggle-on-home');
  assert.ok(first.manifest.operations.length > 10);
  assert.ok(
    !first.manifest.operations.some(
      (op) => op.op === 'ensure_page' && (op.key === 'toggles.sources' || op.title === '데이터 원본'),
    ),
  );
  const mapHome = first.manifest.operations.find((op) => op.op === 'map_supplied_root');
  assert.ok(mapHome);
  assert.equal(mapHome.key, 'pages.home');
  const sourcesIndex = first.manifest.operations.find((op) => op.op === 'write_root_sources_index');
  assert.ok(sourcesIndex);
  assert.equal(sourcesIndex.payload.strategy, 'details-toggle-on-home');
  assert.equal(sourcesIndex.expectedParentKey, 'pages.home');
  assert.match(sourcesIndex.payload.content, /<details>/);
  assert.match(sourcesIndex.payload.content, /데이터 원본/);

  const bodyOps = first.manifest.operations.filter((op) => op.op === 'write_page_body');
  assert.ok(bodyOps.length >= 18);
  const homeBody = bodyOps.find((op) => op.key === 'pages.home');
  assert.ok(homeBody);
  assert.match(String(homeBody.payload.content), /<details>/);
  assert.ok(
    bodyOps
      .filter((op) => op.key.startsWith('pages.'))
      .every((op) => String(op.payload.content).includes('<columns>')),
  );

  const ensureOps = first.manifest.operations.filter(
    (op) => op.op === 'ensure_page' || op.op === 'ensure_database' || op.op === 'map_supplied_root',
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
    (o) => o.op === 'ensure_page' || o.op === 'ensure_database' || o.op === 'map_supplied_root',
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
    chrome: Object.fromEntries(
      first.manifest.operations
        .filter((op) => op.op === 'write_page_body' && op.key.startsWith('pages.'))
        .map((op) => [op.key, true]),
    ),
  };
  const validation = validateSnapshot({ manifest: first.manifest, snapshot });
  assert.equal(validation.ok, true);
});

test('sidebar renderer highlights active nested section', () => {
  const refs = loadNotionReferences(skillRoot);
  const mappings = Object.fromEntries(
    refs.iaGraph.nav.topLevel.concat(refs.iaGraph.nav.nested['pages.spec']).map((key) => [
      key,
      { url: `https://app.notion.com/p/${key}` },
    ]),
  );
  const md = renderSidebarPageContent({
    activeKey: 'pages.data-model',
    mappings,
    nav: refs.iaGraph.nav,
    bodyMarkdown: '# Data model\nBody',
    childBlocks: ['<database url="https://app.notion.com/p/db" inline="true">Data model</database>'],
  });
  assert.match(md, /<columns>/);
  assert.match(md, /<details>/);
  assert.match(
    md,
    /<summary><mention-page url="https:\/\/app\.notion\.com\/p\/pages\.spec"\/> \{color="yellow_bg"\}<\/summary>/,
  );
  assert.match(
    md,
    /\t\t\t\t- <mention-page url="https:\/\/app\.notion\.com\/p\/pages\.data-model"\/> \{color="yellow_bg"\}/,
  );
  assert.match(md, /ratio="80">[\s\S]*inline="true"[\s\S]*<\/column>\s*<\/columns>/);
  assert.doesNotMatch(md, /<\/columns>\s*<database/);
});

test('validateMapping rejects wrong type/parent', () => {
  const ok = validateMapping({
    key: 'pages.prds',
    mapping: { id: 'abc', type: 'page', parentKey: 'pages.planning' },
    expectedType: 'page',
    expectedParentKey: 'pages.planning',
  });
  assert.equal(ok.ok, true);
  const bad = validateMapping({
    key: 'pages.prds',
    mapping: { id: 'abc', type: 'database', parentKey: 'root' },
    expectedType: 'page',
    expectedParentKey: 'pages.planning',
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
    const state = JSON.parse(readFileSync(join(root, '.omd/state.json'), 'utf8'));
    assert.equal(state.provider.notion.mappings['pages.home'].id, dogfoodRoot);
    assert.ok(state.provider.notion.pendingOperationIds.length > 0);
    assert.ok(!state.provider.notion.pendingOperationIds.includes('ensure:pages.home'));
    const agents = readFileSync(join(root, 'AGENTS.md'), 'utf8');
    assert.match(agents, /contentSource\.ssot/);
    assert.match(agents, /Documentation is always first/);
    assert.match(agents, /<!-- oh-my-docs:start -->/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
