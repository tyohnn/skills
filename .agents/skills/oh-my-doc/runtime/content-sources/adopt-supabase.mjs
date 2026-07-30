import {
  createDefaultProject,
  createDefaultState,
  readProject,
  writeOmdContract,
} from '../omd-contract.mjs';
import { adoptProject } from '../adopt.mjs';
import {
  SUPABASE_SCHEMA_VERSION,
  capabilityBlockers,
  planProvision,
  recordResult,
} from './supabase.mjs';

/**
 * Adopt with BYO Supabase SSOT: scaffold Fumadocs locally, emit SQL/seed manifest.
 *
 * @param {{
 *   cwd: string,
 *   skillRoot: string,
 *   schemasDir: string,
 *   templateRoot: string,
 *   dryRun?: boolean,
 *   force?: boolean,
 *   projectRef?: string,
 *   authenticated?: boolean,
 *   projectAccessible?: boolean,
 *   cliOrMcpAvailable?: boolean,
 *   results?: Array<{ operationId: string, status: 'completed' | 'skipped' | 'failed', projectRef?: string }>,
 *   uiPath?: string,
 *   packageManager?: string,
 * }} options
 */
export function adoptSupabaseProject(options) {
  const planned = planProvision({
    skillRoot: options.skillRoot,
    cwd: options.cwd,
    projectRef: options.projectRef,
    schemaVersion: SUPABASE_SCHEMA_VERSION,
  });

  const blockers = [
    ...planned.blockers,
    ...capabilityBlockers({
      authenticated: options.authenticated,
      projectAccessible: options.projectAccessible,
      cliOrMcpAvailable: options.cliOrMcpAvailable,
    }),
  ];

  const projectRef =
    options.projectRef ??
    options.results?.find((r) => r.projectRef)?.projectRef ??
    'PENDING_PROJECT_REF';

  const localAdopt = adoptProject({
    cwd: options.cwd,
    templateRoot: options.templateRoot,
    skillRoot: options.skillRoot,
    schemasDir: options.schemasDir,
    dryRun: options.dryRun === true,
    force: options.force,
    ...(options.uiPath ? { uiPath: options.uiPath } : {}),
    ...(options.packageManager ? { packageManager: options.packageManager } : {}),
  });

  const docsPath = localAdopt.contract?.paths?.docs ?? 'docs';
  const uiPath = localAdopt.contract?.paths?.ui ?? 'packages/docs-ui';

  const contract = createDefaultProject(options.cwd, {
    mode: localAdopt.mode === 'brownfield' ? 'brownfield' : 'greenfield',
    docsPath,
    uiPath,
    contentSource: {
      ssot: 'supabase',
      supabase: {
        projectRef,
        schemaVersion: SUPABASE_SCHEMA_VERSION,
      },
    },
  });

  let provider;
  if (options.results) {
    provider = recordResult({
      manifest: planned.manifest,
      manifestDigest: planned.manifestDigest,
      projectRef,
      results: options.results,
    });
  } else {
    provider = {
      supabase: {
        schemaVersion: SUPABASE_SCHEMA_VERSION,
        schemaDigest: planned.manifestDigest,
        lastObservedAt: new Date().toISOString(),
        lastManifestDigest: planned.manifestDigest,
        projectRef,
        pendingOperationIds: planned.manifest.operations.map((op) => String(op.id)),
        completedOperationIds: [],
      },
    };
  }

  const state = createDefaultState(contract, {
    provider,
    files: localAdopt.state?.files,
  });

  if (options.dryRun) {
    return {
      ok: blockers.length === 0,
      dryRun: true,
      mode: 'supabase',
      contentSource: contract.contentSource,
      blockers,
      manifest: planned.manifest,
      manifestDigest: planned.manifestDigest,
      localScaffoldOperations: localAdopt.operations,
      next: 'Apply the SQL/seed manifest with Supabase CLI or MCP, then re-run adopt/sync.',
    };
  }

  if (blockers.length > 0 && !options.force) {
    return {
      ok: false,
      dryRun: false,
      mode: 'supabase',
      contentSource: contract.contentSource,
      blockers,
      manifest: planned.manifest,
      manifestDigest: planned.manifestDigest,
      localAdopt,
    };
  }

  // adoptProject already wrote a local contract; overlay supabase SSOT.
  writeOmdContract(options.cwd, contract, state, options.schemasDir);

  const written = readProject(options.cwd);
  return {
    ok: true,
    dryRun: false,
    mode: 'supabase',
    contentSource: written?.contentSource ?? contract.contentSource,
    blockers,
    manifest: planned.manifest,
    manifestDigest: planned.manifestDigest,
    localAdopt,
    next: 'Execute pending Supabase manifest operations (SQL + catalog seed). Configure SUPABASE_URL + publishable key for Fumadocs remote reads.',
  };
}
