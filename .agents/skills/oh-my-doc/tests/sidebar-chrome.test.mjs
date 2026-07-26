import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadNotionReferences } from '../runtime/content-sources/load-references.mjs';
import { planProvision } from '../runtime/content-sources/notion.mjs';
import {
  renderSidebarPageContent,
  resolveActiveSection,
  validateManifestSidebarChrome,
  validateSidebarChrome,
} from '../runtime/content-sources/sidebar.mjs';

const skillRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const dogfoodRoot = '3a7346da-c456-800a-85f4-cae724925f98';

function placeholderMappings(nav) {
  const keys = new Set(nav.topLevel);
  for (const children of Object.values(nav.nested)) {
    for (const key of children) keys.add(key);
  }
  return Object.fromEntries([...keys].map((key) => [key, { url: `{{${key}}}` }]));
}

test('sidebar wraps nested children in details toggles with yellow active summary', () => {
  const refs = loadNotionReferences(skillRoot);
  const mappings = placeholderMappings(refs.iaGraph.nav);

  for (const [parent, children] of Object.entries(refs.iaGraph.nav.nested)) {
    for (const activeKey of [parent, ...children]) {
      const md = renderSidebarPageContent({
        activeKey,
        mappings,
        nav: refs.iaGraph.nav,
        bodyMarkdown: `# ${activeKey}`,
      });
      assert.match(md, /<columns>/);
      assert.match(md, /ratio="20"/);
      assert.match(md, /<details>/);
      assert.equal(resolveActiveSection(activeKey, refs.iaGraph.nav), parent);

      const result = validateSidebarChrome(md, {
        activeKey,
        nav: refs.iaGraph.nav,
      });
      assert.equal(
        result.ok,
        true,
        `${activeKey}: ${result.problems.map((p) => p.message).join('; ')}`,
      );

      assert.match(
        md,
        new RegExp(
          `<summary><mention-page url="\\{\\{${parent}\\}\\}"/> \\{color="yellow_bg"\\}</summary>`,
        ),
      );
      for (const child of children) {
        assert.match(
          md,
          new RegExp(`\\t\\t\\t\\t- <mention-page url="\\{\\{${child}\\}\\}"/>`),
        );
      }
      if (children.includes(activeKey)) {
        assert.match(
          md,
          new RegExp(
            `\\t\\t\\t\\t- <mention-page url="\\{\\{${activeKey}\\}\\}"/> \\{color="yellow_bg"\\}`,
          ),
        );
      }
    }
  }
});

test('sidebar always emits details toggles for every nested parent', () => {
  const refs = loadNotionReferences(skillRoot);
  const mappings = placeholderMappings(refs.iaGraph.nav);
  const md = renderSidebarPageContent({
    activeKey: 'pages.vision',
    mappings,
    nav: refs.iaGraph.nav,
    bodyMarkdown: '# Vision',
  });
  const result = validateSidebarChrome(md, {
    activeKey: 'pages.vision',
    nav: refs.iaGraph.nav,
  });
  assert.equal(result.ok, true, result.problems.map((p) => p.message).join('; '));
  assert.match(md, new RegExp('- <mention-page url="\\{\\{pages\\.vision\\}\\}"/> \\{color="yellow_bg"\\}'));
  for (const parent of Object.keys(refs.iaGraph.nav.nested)) {
    assert.match(md, new RegExp(`url="\\{\\{${parent}\\}\\}"`));
    assert.match(md, /<details>/);
  }
  assert.match(md, /<summary><mention-page url="\{\{pages\.spec\}\}"\/><\/summary>/);
  assert.match(md, /\t\t\t\t- <mention-page url="\{\{pages\.system-model\}\}"\/>/);
});

test('PRDs appear under Planning only, not as a root nav leaf', () => {
  const refs = loadNotionReferences(skillRoot);
  assert.equal(refs.iaGraph.nav.topLevel.includes('pages.prds'), false);
  assert.deepEqual(refs.iaGraph.nav.nested['pages.planning'], [
    'pages.prds',
    'pages.stories',
  ]);
  const mappings = placeholderMappings(refs.iaGraph.nav);
  const md = renderSidebarPageContent({
    activeKey: 'pages.plans',
    mappings,
    nav: refs.iaGraph.nav,
    bodyMarkdown: '# Plans',
  });
  assert.match(
    md,
    /<summary><mention-page url="\{\{pages\.planning\}\}"\/><\/summary>[\s\S]*?- <mention-page url="\{\{pages\.prds\}\}"\/>/,
  );
  assert.doesNotMatch(
    md,
    /<\/details>\s*- <mention-page url="\{\{pages\.prds\}\}"\/>/,
  );
  assert.match(md, /- <mention-page url="\{\{pages\.plans\}\}"\/> \{color="yellow_bg"\}/);
});

test('Spec default IA has data-model and system-model only (no CLI page)', () => {
  const refs = loadNotionReferences(skillRoot);
  assert.deepEqual(refs.iaGraph.nav.nested['pages.spec'], [
    'pages.data-model',
    'pages.system-model',
  ]);
  assert.equal(
    refs.iaGraph.objects.some((o) => o.key === 'pages.cli'),
    false,
  );
});

test('validateSidebarChrome rejects missing details toggle for nested parent', () => {
  const refs = loadNotionReferences(skillRoot);
  const bad = `<columns>
	<column ratio="20">
		<callout icon="📌" color="gray_bg">
			- <mention-page url="{{pages.home}}"/>
			- <mention-page url="{{pages.vision}}"/>
			- <mention-page url="{{pages.starting}}"/>
			- <mention-page url="{{pages.workflow}}"/>
			- <mention-page url="{{pages.domain}}"/>
			- <mention-page url="{{pages.planning}}"/>
			- <mention-page url="{{pages.spec}}"/> {color="yellow_bg"}
			- <mention-page url="{{pages.plans}}"/>
			- <mention-page url="{{pages.adrs}}"/>
		</callout>
	</column>
	<column ratio="80">
		# Spec
	</column>
</columns>
`;
  const result = validateSidebarChrome(bad, {
    activeKey: 'pages.spec',
    nav: refs.iaGraph.nav,
  });
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((p) => p.code === 'chrome_missing_details_toggle'));
});

test('validateSidebarChrome rejects missing yellow nested group', () => {
  const refs = loadNotionReferences(skillRoot);
  const bad = `<columns>
	<column ratio="20">
		<callout icon="📌" color="gray_bg">
			- <mention-page url="{{pages.home}}"/>
			- <mention-page url="{{pages.vision}}"/>
			- <mention-page url="{{pages.starting}}"/>
			<details>
			<summary><mention-page url="{{pages.workflow}}"/></summary>
				- <mention-page url="{{pages.workflow-planning}}"/>
				- <mention-page url="{{pages.development}}"/>
			</details>
			<details>
			<summary><mention-page url="{{pages.domain}}"/></summary>
				- <mention-page url="{{pages.glossary}}"/>
				- <mention-page url="{{pages.models}}"/>
				- <mention-page url="{{pages.policies}}"/>
			</details>
			<details>
			<summary><mention-page url="{{pages.planning}}"/></summary>
				- <mention-page url="{{pages.prds}}"/>
				- <mention-page url="{{pages.stories}}"/>
			</details>
			<details>
			<summary><mention-page url="{{pages.spec}}"/></summary>
				- <mention-page url="{{pages.data-model}}"/>
				- <mention-page url="{{pages.system-model}}"/>
			</details>
			- <mention-page url="{{pages.plans}}"/>
			- <mention-page url="{{pages.adrs}}"/>
		</callout>
	</column>
	<column ratio="80">
		# Spec
	</column>
</columns>
`;
  const result = validateSidebarChrome(bad, {
    activeKey: 'pages.spec',
    nav: refs.iaGraph.nav,
  });
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((p) => p.code === 'chrome_missing_yellow_group'));
});

test('planProvision bodies all pass validateManifestSidebarChrome', () => {
  const planned = planProvision({ skillRoot, notionRoot: dogfoodRoot });
  assert.equal(planned.ok, true);
  assert.equal(planned.manifest.chromeValidation.ok, true);
  const result = validateManifestSidebarChrome({
    operations: planned.manifest.operations,
    nav: planned.manifest.nav,
  });
  assert.equal(result.ok, true, result.problems.map((p) => p.message).join('; '));

  const bodyOps = planned.manifest.operations.filter(
    (op) => op.op === 'write_page_body' && op.key.startsWith('pages.'),
  );
  assert.ok(bodyOps.length >= 18);
  for (const op of bodyOps) {
    const content = String(op.payload.content);
    assert.match(content, /<details>/);
    assert.match(content, /<summary>/);
    assert.match(content, /<columns>/);
    assert.doesNotMatch(content, /<\/columns>\s*<(?:page|database|details)\b/);
  }
});

test('validateSidebarChrome rejects content left after columns', () => {
  const refs = loadNotionReferences(skillRoot);
  const bad = `<columns>
	<column ratio="20">
		<callout icon="📌" color="gray_bg">
			- <mention-page url="{{pages.home}}"/>
			- <mention-page url="{{pages.vision}}"/> {color="yellow_bg"}
			- <mention-page url="{{pages.starting}}"/>
			<details>
			<summary><mention-page url="{{pages.workflow}}"/></summary>
				- <mention-page url="{{pages.workflow-planning}}"/>
				- <mention-page url="{{pages.development}}"/>
			</details>
			<details>
			<summary><mention-page url="{{pages.domain}}"/></summary>
				- <mention-page url="{{pages.glossary}}"/>
				- <mention-page url="{{pages.models}}"/>
				- <mention-page url="{{pages.policies}}"/>
			</details>
			<details>
			<summary><mention-page url="{{pages.planning}}"/></summary>
				- <mention-page url="{{pages.prds}}"/>
				- <mention-page url="{{pages.stories}}"/>
			</details>
			<details>
			<summary><mention-page url="{{pages.spec}}"/></summary>
				- <mention-page url="{{pages.data-model}}"/>
				- <mention-page url="{{pages.system-model}}"/>
			</details>
			- <mention-page url="{{pages.plans}}"/>
			- <mention-page url="{{pages.adrs}}"/>
		</callout>
	</column>
	<column ratio="80">
		# Vision
	</column>
</columns>
<page url="{{pages.extra}}">Extra</page>
`;
  const result = validateSidebarChrome(bad, {
    activeKey: 'pages.vision',
    nav: refs.iaGraph.nav,
  });
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((p) => p.code === 'chrome_content_outside_right_column'));
});
