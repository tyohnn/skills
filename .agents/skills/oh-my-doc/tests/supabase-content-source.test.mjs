import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  createContentSource,
  handbookPgSchema,
  normalizeContentSource,
} from '../runtime/omd-contract.mjs';
import {
  containsForbiddenSecrets,
  planCreateDocument,
  planProvision,
  recordResult,
  validateSnapshot,
  SUPABASE_SCHEMA_VERSION,
} from '../runtime/content-sources/supabase.mjs';
import { resolveContentSource, getContentAdapter } from '../runtime/content-sources/index.mjs';

const skillRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

test('normalizeContentSource accepts supabase', () => {
  const normalized = normalizeContentSource({
    contentSource: {
      ssot: 'supabase',
      supabase: { projectRef: 'abcdefghijklmnop', schemaVersion: '1.0' },
    },
  });
  assert.equal(normalized.ssot, 'supabase');
  assert.equal(normalized.supabase.projectRef, 'abcdefghijklmnop');
  assert.equal(normalized.notion, null);
});

test('createContentSource requires projectRef for supabase', () => {
  assert.throws(() => createContentSource('supabase', null, null), /projectRef/);
  const cs = createContentSource('supabase', null, { projectRef: 'ref1234567890' });
  assert.equal(cs.ssot, 'supabase');
  assert.equal(cs.supabase.schemaVersion, '1.0');
});

test('handbookId normalizes and maps to pg schema', () => {
  const normalized = normalizeContentSource({
    contentSource: {
      ssot: 'supabase',
      supabase: {
        projectRef: 'abcdefghijklmnop',
        schemaVersion: '1.1',
        handbookId: 'oh-my-docs',
      },
    },
  });
  assert.equal(normalized.supabase.handbookId, 'oh-my-docs');
  assert.equal(handbookPgSchema('oh-my-docs'), 'omd_h_oh_my_docs');
  assert.equal(handbookPgSchema('tyohnn-studio'), 'omd_h_tyohnn_studio');
  assert.equal(handbookPgSchema(undefined), 'public');
  const cs = createContentSource('supabase', null, {
    projectRef: 'ref1234567890',
    handbookId: 'skills',
    schemaVersion: '1.1',
  });
  assert.equal(cs.supabase.handbookId, 'skills');
});

test('planProvision is idempotent for the same inputs', () => {
  const first = planProvision({ skillRoot, projectRef: 'ref1234567890' });
  const second = planProvision({ skillRoot, projectRef: 'ref1234567890' });
  assert.equal(first.manifestDigest, second.manifestDigest);
  assert.ok(first.manifest.operations.some((op) => op.op === 'apply_sql'));
  assert.ok(first.manifest.operations.some((op) => op.op === 'upsert_catalog_meta'));
  assert.equal(first.manifest.schemaVersion, SUPABASE_SCHEMA_VERSION);
});

test('planCreateDocument targets plans catalog for plan kind', () => {
  const planned = planCreateDocument({
    skillRoot,
    kind: 'plan',
    title: 'Example',
    id: 'PLAN-example',
  });
  assert.equal(planned.operation.op, 'upsert_document');
  assert.equal(planned.catalogKey, 'dbs.plans');
  assert.equal(planned.operation.document.id, 'PLAN-example');
});

test('validateSnapshot and secret detection', () => {
  const ok = validateSnapshot({
    projectRef: 'ref1234567890',
    schemaVersion: '1.0',
    pendingOperationIds: [],
  });
  assert.equal(ok.ok, true);
  const bad = validateSnapshot({
    projectRef: '',
    pendingOperationIds: ['x'],
    hasSecretInContract: true,
  });
  assert.equal(bad.ok, false);
  assert.ok(containsForbiddenSecrets({ service_role: 'secret' }));
  assert.ok(!containsForbiddenSecrets({ projectRef: 'abc' }));
});

test('recordResult tracks pending and completed ops', () => {
  const planned = planProvision({ skillRoot, projectRef: 'ref1234567890' });
  const firstOp = planned.manifest.operations[0];
  const provider = recordResult({
    manifest: planned.manifest,
    manifestDigest: planned.manifestDigest,
    projectRef: 'ref1234567890',
    results: [{ operationId: firstOp.id, status: 'completed', projectRef: 'ref1234567890' }],
  });
  assert.ok(provider.supabase.completedOperationIds.includes(firstOp.id));
  assert.ok(provider.supabase.pendingOperationIds.length > 0);
});

test('getContentAdapter(supabase) exposes port ops', () => {
  const adapter = getContentAdapter('supabase');
  assert.equal(adapter.ssot, 'supabase');
  assert.equal(typeof adapter.planProvision, 'function');
  assert.equal(typeof adapter.planCreateDocument, 'function');
});

test('resolveContentSource supabase from flags', () => {
  const root = mkdtempSync(join(tmpdir(), 'omd-supabase-resolve-'));
  try {
    const resolved = resolveContentSource({
      cwd: root,
      ssot: 'supabase',
      projectRef: 'ref1234567890',
    });
    assert.equal(resolved.ssot, 'supabase');
    assert.equal(resolved.supabase.projectRef, 'ref1234567890');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('greenfield adopt needsSsot options include supabase', async () => {
  const root = mkdtempSync(join(tmpdir(), 'omd-needs-ssot-supabase-'));
  const prev = process.cwd();
  const originalExit = process.exitCode;
  /** @type {string[]} */
  const lines = [];
  const originalLog = console.log;
  try {
    process.chdir(root);
    process.exitCode = 0;
    console.log = (...args) => {
      lines.push(args.map(String).join(' '));
    };
    const { main } = await import('../scripts/omd.mjs');
    await main(['adopt', '--dry-run', '--json']);
    assert.equal(process.exitCode, 1);
    const payload = JSON.parse(lines.join('\n'));
    assert.equal(payload.code, 'needsSsot');
    assert.ok(payload.options.includes('supabase'));
  } finally {
    console.log = originalLog;
    process.exitCode = originalExit;
    process.chdir(prev);
    rmSync(root, { recursive: true, force: true });
  }
});
