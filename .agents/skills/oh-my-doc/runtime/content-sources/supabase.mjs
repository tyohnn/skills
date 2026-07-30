import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { digest, stableStringify } from '../omd-contract.mjs';
import { loadHandbookIaGraph, databaseKeyForKind } from '../ia-graph.mjs';

export const SUPABASE_SCHEMA_VERSION = '1.0';

/**
 * @param {string} skillRoot
 */
/**
 * Prefer docs-app embedded SQL (`docs/supabase/` or `apps/docs/supabase/`),
 * then fall back to the skill reference copy.
 *
 * @param {string} skillRoot
 * @param {string} [cwd]
 */
/**
 * @param {string} skillRoot
 * @param {string} [cwd]
 * @param {string} [schemaVersion]
 */
export function loadSupabaseSchemaSql(skillRoot, cwd = process.cwd(), schemaVersion = SUPABASE_SCHEMA_VERSION) {
  const version = String(schemaVersion || SUPABASE_SCHEMA_VERSION);
  const file = `schema-${version}.sql`;
  const candidates = [
    join(cwd, 'apps/docs/supabase', file),
    join(cwd, 'docs/supabase', file),
    join(skillRoot, 'templates/default/docs/supabase', file),
    // Prefer newest bundled schema when requested version is missing locally.
    join(cwd, 'apps/docs/supabase/schema-1.1.sql'),
    join(cwd, 'docs/supabase/schema-1.1.sql'),
    join(skillRoot, 'templates/default/docs/supabase/schema-1.1.sql'),
    join(cwd, 'apps/docs/supabase/schema-1.0.sql'),
    join(cwd, 'docs/supabase/schema-1.0.sql'),
    join(skillRoot, 'templates/default/docs/supabase/schema-1.0.sql'),
    join(skillRoot, 'references/supabase-schema-1.0.sql'),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      return readFileSync(path, 'utf8');
    }
  }
  throw new Error(
    `missing supabase schema SQL (looked under docs/supabase and ${join(skillRoot, 'references')})`,
  );
}

/**
 * @param {{
 *   authenticated?: boolean,
 *   projectAccessible?: boolean,
 *   cliOrMcpAvailable?: boolean,
 * }} [flags]
 */
export function capabilityBlockers(flags = {}) {
  /** @type {Array<{ code: string, message: string }>} */
  const blockers = [];
  if (flags.cliOrMcpAvailable === false) {
    blockers.push({
      code: 'capability_missing',
      message:
        'Supabase CLI or MCP is required to apply provision manifests. Install/login or configure the host Supabase MCP.',
    });
  }
  if (flags.authenticated === false) {
    blockers.push({
      code: 'supabase_login_required',
      message: 'Host is not logged into Supabase. Run `supabase login` or authenticate the Supabase MCP.',
    });
  }
  if (flags.projectAccessible === false) {
    blockers.push({
      code: 'project_inaccessible',
      message: 'Linked Supabase project is missing or inaccessible to the host.',
    });
  }
  return blockers;
}

/**
 * @param {{
 *   skillRoot: string,
 *   cwd?: string,
 *   projectRef?: string,
 *   schemaVersion?: string,
 *   pendingOperationIds?: string[],
 * }} options
 */
export function planProvision(options) {
  const schemaVersion = options.schemaVersion ?? SUPABASE_SCHEMA_VERSION;
  const sql = loadSupabaseSchemaSql(options.skillRoot, options.cwd, schemaVersion);
  const graph = loadHandbookIaGraph();
  const catalogKeys = (graph.objects ?? [])
    .filter((o) => o.metaRole === 'catalog-index' && o.databaseKey)
    .map((o) => String(o.databaseKey));
  const schemaFile = `schema-${schemaVersion}.sql`;

  /** @type {Array<Record<string, unknown>>} */
  const operations = [];
  operations.push({
    id: `supabase.apply_schema_${String(schemaVersion).replace(/\./g, '_')}`,
    op: 'apply_sql',
    schemaVersion,
    sql,
  });

  if (options.projectRef) {
    operations.push({
      id: 'supabase.link_project',
      op: 'link_project',
      projectRef: options.projectRef,
    });
  } else {
    operations.push({
      id: 'supabase.ensure_project',
      op: 'ensure_project',
      nameHint: 'oh-my-docs',
    });
  }

  operations.push({
    id: 'supabase.scaffold_docs_schema_sql',
    op: 'scaffold_docs_supabase_sql',
    relativePath: `docs/supabase/${schemaFile}`,
  });

  for (const key of catalogKeys) {
    operations.push({
      id: `supabase.seed_catalog.${key}`,
      op: 'upsert_catalog_meta',
      catalogKey: key,
      pages: ['index'],
    });
  }

  const pending = new Set(options.pendingOperationIds ?? []);
  const filtered =
    pending.size > 0
      ? operations.filter((op) => pending.has(String(op.id)))
      : operations;

  const manifest = {
    provider: 'supabase',
    schemaVersion,
    projectRef: options.projectRef ?? null,
    operations: filtered,
  };
  const manifestDigest = digest(stableStringify(manifest));

  return {
    blockers: [],
    manifest,
    manifestDigest,
  };
}

/**
 * @param {{
 *   skillRoot: string,
 *   kind: string,
 *   title: string,
 *   id: string,
 *   path?: string,
 *   frontmatter?: Record<string, unknown>,
 *   bodyMdx?: string,
 * }} options
 */
export function planCreateDocument(options) {
  const graph = loadHandbookIaGraph();
  const dbKey = databaseKeyForKind(graph, options.kind);
  const path =
    options.path ??
    defaultPathForKind(options.kind, options.id);

  const operation = {
    id: `supabase.upsert_document.${options.id}`,
    op: 'upsert_document',
    document: {
      id: options.id,
      kind: options.kind,
      ticker: options.frontmatter?.ticker ?? null,
      path,
      frontmatter: {
        title: options.title,
        id: options.id,
        ...(options.frontmatter ?? {}),
      },
      body_mdx: options.bodyMdx ?? '',
    },
    catalogKey: dbKey,
  };

  return {
    operation,
    requiresMappedProject: false,
    catalogKey: dbKey,
  };
}

/**
 * @param {string} kind
 * @param {string} id
 */
function defaultPathForKind(kind, id) {
  const slug = id
    .replace(/^PRD-/i, 'prd-')
    .replace(/^US-/i, 'us-')
    .replace(/^SPEC-/i, 'spec-')
    .replace(/^PLAN-/i, 'plan-')
    .replace(/^ADR-/i, 'adr-')
    .toLowerCase();
  switch (kind) {
    case 'prd':
      return `planning/prds/${slug}`;
    case 'story':
      return `planning/stories/${slug}`;
    case 'spec':
      return `spec/${slug}`;
    case 'plan':
      return `plans/${slug}`;
    case 'adr':
      return `adr/${slug}`;
    default:
      return slug;
  }
}

/**
 * @param {{
 *   projectRef?: string | null,
 *   schemaVersion?: string | null,
 *   expectedSchemaVersion?: string,
 *   pendingOperationIds?: string[],
 *   hasSecretInContract?: boolean,
 * }} snapshot
 */
export function validateSnapshot(snapshot) {
  /** @type {string[]} */
  const problems = [];
  if (!snapshot.projectRef) {
    problems.push('project_inaccessible: contentSource.supabase.projectRef is required');
  }
  if (snapshot.hasSecretInContract) {
    problems.push('secret_in_contract: credentials must not appear in project/state JSON');
  }
  const expected = snapshot.expectedSchemaVersion ?? SUPABASE_SCHEMA_VERSION;
  if (snapshot.schemaVersion && snapshot.schemaVersion !== expected) {
    problems.push(
      `schema_drift: live schemaVersion ${snapshot.schemaVersion} !== expected ${expected}`,
    );
  }
  if ((snapshot.pendingOperationIds ?? []).length > 0) {
    problems.push(
      `partial_apply: ${snapshot.pendingOperationIds.length} pending Supabase operation(s)`,
    );
  }
  return { ok: problems.length === 0, problems };
}

/**
 * @param {{
 *   manifest: { schemaVersion: string, projectRef?: string | null, operations: Array<{ id: string }> },
 *   manifestDigest: string,
 *   projectRef?: string,
 *   results?: Array<{ operationId: string, status: 'completed' | 'skipped' | 'failed', projectRef?: string }>,
 * }} input
 */
export function recordResult(input) {
  const completed = [];
  const pending = [];
  let projectRef = input.projectRef ?? input.manifest.projectRef ?? null;
  for (const op of input.manifest.operations) {
    const result = (input.results ?? []).find((r) => r.operationId === op.id);
    if (!result || result.status === 'failed') {
      pending.push(op.id);
      continue;
    }
    completed.push(op.id);
    if (result.projectRef) projectRef = result.projectRef;
  }
  return {
    supabase: {
      schemaVersion: input.manifest.schemaVersion,
      schemaDigest: input.manifestDigest,
      lastObservedAt: new Date().toISOString(),
      lastManifestDigest: input.manifestDigest,
      projectRef,
      pendingOperationIds: pending,
      completedOperationIds: completed,
    },
  };
}

/**
 * Reject obvious secret material in contract/state JSON text.
 * @param {unknown} value
 */
export function containsForbiddenSecrets(value) {
  const text = typeof value === 'string' ? value : stableStringify(value);
  return (
    /service_role/i.test(text) ||
    /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\./.test(text) ||
    /sb_secret_/i.test(text) ||
    /password\s*[:=]/i.test(text)
  );
}
