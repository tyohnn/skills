import assert from 'node:assert/strict';
import test from 'node:test';

import { createCatalogNavigation, indexOnlyPageTree } from './navigation.ts';

const pages = [
  { slugs: ['planning', 'prds'], url: '/docs/planning/prds', data: { title: 'PRDs' } },
  {
    slugs: ['planning', 'prds', 'prd-2'],
    url: '/docs/planning/prds/prd-2',
    data: { title: 'Second', description: 'Second item' },
  },
  {
    slugs: ['planning', 'prds', 'prd-10'],
    url: '/docs/planning/prds/prd-10',
    data: { title: 'Tenth' },
  },
];

const navigation = createCatalogNavigation(
  { getPages: () => pages },
  [{ prefix: ['planning', 'prds'], indexUrl: '/docs/planning/prds', label: 'PRD' }],
);

test('returns the catalog index link only for details', () => {
  assert.deepEqual(navigation.indexLink(['planning', 'prds', 'prd-2']), {
    href: '/docs/planning/prds',
    label: 'PRD',
  });
  assert.equal(navigation.indexLink(['planning', 'prds']), undefined);
});

test('sorts sibling footer navigation naturally', () => {
  assert.deepEqual(navigation.footerItems(['planning', 'prds', 'prd-10']), {
    previous: {
      name: 'Second',
      description: 'Second item',
      url: '/docs/planning/prds/prd-2',
    },
  });
});

test('collapses configured catalog folders to their index', () => {
  const [transformer] = indexOnlyPageTree(['/docs/planning/prds/']).transformers;
  assert.ok(transformer);
  const folder = {
    type: 'folder' as const,
    name: 'PRDs',
    index: { type: 'page' as const, name: 'PRDs', url: '/docs/planning/prds' },
    children: [
      { type: 'page' as const, name: 'Second', url: '/docs/planning/prds/prd-2' },
    ],
  };
  assert.deepEqual(transformer.folder(folder as Parameters<typeof transformer.folder>[0]), {
    ...folder,
    children: [],
    defaultOpen: false,
  });
});
