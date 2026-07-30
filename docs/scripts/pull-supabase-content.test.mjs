import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  applyCatalogIndexBodies,
  buildCatalogIndexBody,
  catalogMetaPayload,
} from './pull-supabase-content.mjs';

describe('buildCatalogIndexBody', () => {
  it('renders PRD rows from catalog pages', () => {
    const body = buildCatalogIndexBody(
      'dbs.prds',
      'planning/prds',
      ['index', 'prd-natural-korean-output-skill'],
      [
        {
          path: 'planning/prds/prd-natural-korean-output-skill',
          ticker: 'PRD-001',
          frontmatter: {
            title: 'Natural Korean output skill',
            status: 'active',
          },
        },
      ],
    );
    assert.match(body, /PRD-001/);
    assert.match(body, /Natural Korean output skill/);
    assert.match(body, /href="\/docs\/planning\/prds\/prd-natural-korean-output-skill"/);
    assert.match(body, />active</);
    assert.doesNotMatch(body, /Add PRDs beside/);
  });

  it('keeps empty placeholder when catalog has no detail pages', () => {
    const body = buildCatalogIndexBody('dbs.prds', 'planning/prds', ['index'], []);
    assert.match(body, /Add PRDs beside this index/);
  });

  it('renders system-model as a markdown list', () => {
    const body = buildCatalogIndexBody(
      'dbs.system-model',
      'spec/system-model',
      ['index', 'spec-natural-korean-tone-contract'],
      [
        {
          path: 'spec/system-model/spec-natural-korean-tone-contract',
          ticker: 'SPEC-001',
          frontmatter: { title: 'Natural Korean tone contract', stage: 'accepted' },
        },
      ],
    );
    assert.match(body, /SPEC-001/);
    assert.match(body, /\/docs\/spec\/system-model\/spec-natural-korean-tone-contract/);
  });
});

describe('applyCatalogIndexBodies', () => {
  it('rewrites index bodies in place', () => {
    const docs = [
      {
        path: 'planning/prds/index',
        body_mdx: 'placeholder',
        frontmatter: { title: 'Product requirements' },
      },
      {
        path: 'planning/prds/prd-natural-korean-output-skill',
        ticker: 'PRD-001',
        frontmatter: { title: 'Natural Korean output skill', status: 'active' },
      },
    ];
    applyCatalogIndexBodies(docs, [
      { catalog_key: 'dbs.prds', pages: ['index', 'prd-natural-korean-output-skill'] },
    ]);
    assert.match(docs[0].body_mdx, /PRD-001/);
  });
});

describe('catalogMetaPayload', () => {
  it('omits index from pages', () => {
    assert.deepEqual(catalogMetaPayload(['index', 'prd-a'], 'Product requirements'), {
      title: 'Product requirements',
      pages: ['prd-a'],
    });
  });
});
