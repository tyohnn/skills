import assert from 'node:assert/strict';
import test from 'node:test';

import { docKindFromSlug } from './doc-kinds.ts';

test('infers kinds only for catalog detail pages', () => {
  assert.equal(docKindFromSlug(['planning', 'prds', 'prd-editor']), 'PRD');
  assert.equal(docKindFromSlug(['planning', 'stories', 'us-editor']), 'US');
  assert.equal(docKindFromSlug(['plans', 'plan-editor']), 'PLAN');
  assert.equal(docKindFromSlug(['adr', 'adr-001']), 'ADR');
  assert.equal(docKindFromSlug(['spec', 'cli']), 'SPEC');
  assert.equal(docKindFromSlug(['spec', 'data-model', 'tasks']), 'SPEC');
  assert.equal(docKindFromSlug(['spec', 'data-model']), null);
  assert.equal(docKindFromSlug(['spec', 'system-model']), null);
  assert.equal(docKindFromSlug(['plans']), null);
  assert.equal(docKindFromSlug(['adr']), null);
  assert.equal(docKindFromSlug(['planning', 'prds']), null);
  assert.equal(docKindFromSlug(undefined), null);
});
