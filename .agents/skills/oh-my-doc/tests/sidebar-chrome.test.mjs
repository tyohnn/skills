import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadNotionReferences } from '../runtime/content-sources/load-references.mjs';
import { planProvision } from '../runtime/content-sources/notion.mjs';
import {
  renderStackedHomeContent,
  renderSidebarPageContent,
  validateManifestSidebarChrome,
  validateSidebarChrome,
  validateStackedHomeContent,
} from '../runtime/content-sources/sidebar.mjs';

const skillRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const dogfoodRoot = '3a7346da-c456-800a-85f4-cae724925f98';

test('Notion IA is Home + stacked DBs (no child pages, no sidebar nav)', () => {
  const refs = loadNotionReferences(skillRoot);
  assert.equal(refs.iaGraph.sourcesStrategy, 'stacked-on-home');
  assert.deepEqual(refs.iaGraph.nav.topLevel, ['pages.home']);
  assert.deepEqual(refs.iaGraph.nav.nested, {});
  assert.equal(refs.iaGraph.objects.filter((o) => o.kind === 'page').length, 1);
  assert.ok(refs.iaGraph.objects.every((o) => o.kind !== 'page' || o.key === 'pages.home'));
  assert.ok(
    refs.iaGraph.objects
      .filter((o) => o.kind === 'database')
      .every((o) => o.parent === 'pages.home' && o.inline === true),
  );
  assert.equal(refs.iaGraph.objects.some((o) => o.key === 'pages.glossary'), false);
  assert.equal(refs.iaGraph.objects.some((o) => o.key === 'pages.vision'), false);
  assert.equal(refs.iaGraph.homeStack?.forbidCatalogHeadings, true);
  assert.deepEqual(
    refs.iaGraph.homeStack.sections.map((s) => s.title),
    ['도메인', '기획', '개발'],
  );
});

test('renderStackedHomeContent uses section headers only (no per-catalog headings)', () => {
  const md = renderStackedHomeContent({
    bodyMarkdown: 'Agent handbook.',
    sections: [
      {
        id: 'domain',
        title: '도메인',
        databases: [
          { key: 'dbs.glossary', title: 'Glossary', url: '{{dbs.glossary}}' },
          { key: 'dbs.models', title: 'Models', url: '{{dbs.models}}' },
        ],
      },
      {
        id: 'planning',
        title: '기획',
        databases: [{ key: 'dbs.prds', title: 'PRDs', url: '{{dbs.prds}}' }],
      },
    ],
  });
  assert.match(md, /^Agent handbook\./m);
  assert.match(md, /^# 도메인$/m);
  assert.match(md, /^# 기획$/m);
  assert.match(md, /<database url="\{\{dbs\.glossary\}\}" inline="true">Glossary<\/database>/);
  assert.doesNotMatch(md, /^# Glossary$/m);
  assert.doesNotMatch(md, /^# Models$/m);
  assert.doesNotMatch(md, /^# PRDs$/m);
  assert.doesNotMatch(md, /<columns>/);
  assert.doesNotMatch(md, /<callout/);
});

test('renderStackedHomeContent refuses flat per-catalog databases option', () => {
  assert.throws(
    () =>
      renderStackedHomeContent({
        bodyMarkdown: 'Agent handbook.',
        databases: [{ key: 'dbs.prds', title: 'PRDs' }],
      }),
    /homeStack\.sections/,
  );
});

test('validateStackedHomeContent rejects catalog headings and wrong section order', () => {
  const homeStack = {
    forbidCatalogHeadings: true,
    sections: [
      { id: 'domain', title: '도메인', databases: ['dbs.glossary', 'dbs.models'] },
      { id: 'planning', title: '기획', databases: ['dbs.prds'] },
    ],
  };
  const bad = `Intro

# Glossary
<database url="{{dbs.glossary}}" inline="true">Glossary</database>
# 기획
<database url="{{dbs.prds}}" inline="true">PRDs</database>
`;
  const result = validateStackedHomeContent(bad, {
    homeStack,
    catalogTitles: ['Glossary', 'Models', 'PRDs'],
  });
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((p) => p.code === 'stack_catalog_heading_forbidden'));
  assert.ok(
    result.problems.some(
      (p) => p.code === 'stack_heading_count' || p.code === 'stack_heading_mismatch',
    ),
  );
});

test('planProvision stacked home uses 도메인/기획/개발 only', () => {
  const planned = planProvision({ skillRoot, notionRoot: dogfoodRoot });
  assert.equal(planned.ok, true);
  assert.equal(planned.manifest.sourcesStrategy, 'stacked-on-home');
  assert.equal(planned.manifest.chrome.requiredOn, 'none');
  assert.equal(planned.manifest.chromeValidation.ok, true);

  assert.equal(
    planned.manifest.operations.filter((op) => op.op === 'ensure_page').length,
    0,
  );

  const bodyOps = planned.manifest.operations.filter((op) => op.op === 'write_page_body');
  assert.equal(bodyOps.length, 1);
  assert.equal(bodyOps[0].key, 'pages.home');
  const content = String(bodyOps[0].payload.content);
  assert.doesNotMatch(content, /<columns>/);
  assert.match(content, /<database\b[^>]*inline="true"/);
  assert.match(content, /^# 도메인$/m);
  assert.match(content, /^# 기획$/m);
  assert.match(content, /^# 개발$/m);
  assert.doesNotMatch(content, /^# Glossary$/m);
  assert.doesNotMatch(content, /^# ADRs$/m);
  assert.doesNotMatch(content, /^# PRDs$/m);

  const refs = loadNotionReferences(skillRoot);
  const result = validateManifestSidebarChrome({
    operations: planned.manifest.operations,
    nav: planned.manifest.nav,
    sourcesStrategy: 'stacked-on-home',
    homeStack: refs.iaGraph.homeStack,
    catalogTitles: refs.iaGraph.objects
      .filter((o) => o.kind === 'database')
      .map((o) => o.title),
  });
  assert.equal(result.ok, true, result.problems.map((p) => p.message).join('; '));
});

test('legacy validateSidebarChrome still rejects broken column chrome', () => {
  const nav = {
    topLevel: ['pages.home', 'pages.prds'],
    nested: {},
  };
  const bad = `<columns>
	<column ratio="20">
		<callout icon="📌" color="gray_bg">
			- <mention-page url="{{pages.home}}"/>
		</callout>
	</column>
	<column ratio="80">
		# PRDs
	</column>
</columns>
`;
  const result = validateSidebarChrome(bad, { activeKey: 'pages.prds', nav });
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((p) => p.code === 'chrome_missing_nav_item'));
});

test('legacy renderSidebarPageContent still emits columns when called directly', () => {
  const md = renderSidebarPageContent({
    activeKey: 'pages.home',
    mappings: { 'pages.home': { url: '{{pages.home}}' } },
    nav: { topLevel: ['pages.home'], nested: {} },
    bodyMarkdown: '# Home',
  });
  assert.match(md, /<columns>/);
});
