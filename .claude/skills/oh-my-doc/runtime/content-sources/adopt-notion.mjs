import {
  acquireLock,
  createDefaultProject,
  createDefaultState,
  releaseLock,
  writeOmdContract,
} from '../omd-contract.mjs';
import { capabilityBlockers, planProvision, recordResult } from './notion.mjs';

/**
 * Plan or record a Notion SSOT adopt.
 * Runtime emits manifests; the host agent executes MCP and may pass results.
 *
 * @param {{
 *   cwd: string,
 *   skillRoot: string,
 *   schemasDir: string,
 *   notionRoot: string,
 *   dryRun?: boolean,
 *   force?: boolean,
 *   mcpAvailable?: boolean,
 *   authenticated?: boolean,
 *   rootAccessible?: boolean,
 *   results?: Array<{ operationId: string, status: 'completed' | 'skipped' | 'failed', object?: { key: string, id: string, type: string } }>,
 * }} options
 */
export function adoptNotionProject(options) {
  const planned = planProvision({
    skillRoot: options.skillRoot,
    notionRoot: options.notionRoot,
  });

  const blockers = [
    ...planned.blockers,
    ...capabilityBlockers({
      mcpAvailable: options.mcpAvailable,
      authenticated: options.authenticated,
      rootAccessible: options.rootAccessible,
    }),
  ];

  const contract = createDefaultProject(options.cwd, {
    mode: 'greenfield',
    contentSource: {
      ssot: 'notion',
      notion: {
        rootPageId: planned.manifest.root.rootPageId,
        rootPageUrl: planned.manifest.root.rootPageUrl,
        schemaVersion: '1.0',
      },
    },
  });

  // Notion v1 does not scaffold a local Fumadocs mirror.
  contract.ownership.omdGenerated = ['.omd/project.json', '.omd/schemas/'];
  contract.ownership.omdManaged = ['AGENTS.md', 'CLAUDE.md'];

  let provider;
  if (options.results) {
    provider = recordResult({
      manifest: planned.manifest,
      manifestDigest: planned.manifestDigest,
      results: options.results,
    });
  } else {
    provider = {
      notion: {
        schemaVersion: '1.0',
        schemaDigest: planned.manifestDigest,
        lastObservedAt: new Date().toISOString(),
        lastManifestDigest: planned.manifestDigest,
        mappings: {},
        pendingOperationIds: planned.manifest.operations.map((op) => op.id),
        completedOperationIds: [],
      },
    };
  }

  const state = createDefaultState(contract, { provider });

  if (options.dryRun) {
    return {
      ok: blockers.length === 0,
      dryRun: true,
      mode: 'notion',
      contentSource: contract.contentSource,
      manifest: planned.manifest,
      manifestDigest: planned.manifestDigest,
      blockers,
      contract,
      state,
      applied: null,
      manualChecklist: planned.manifest.manualChecklist,
    };
  }

  if (blockers.length > 0 && !options.force) {
    return {
      ok: false,
      dryRun: false,
      mode: 'notion',
      contentSource: contract.contentSource,
      manifest: planned.manifest,
      manifestDigest: planned.manifestDigest,
      blockers,
      contract,
      state,
      applied: null,
      manualChecklist: planned.manifest.manualChecklist,
    };
  }

  acquireLock(options.cwd);
  try {
    writeOmdContract(options.cwd, contract, state, options.schemasDir);
    return {
      ok: true,
      dryRun: false,
      mode: 'notion',
      contentSource: contract.contentSource,
      manifest: planned.manifest,
      manifestDigest: planned.manifestDigest,
      blockers,
      contract,
      state,
      applied: { wrote: ['.omd/project.json', '.omd/state.json'] },
      manualChecklist: planned.manifest.manualChecklist,
      next: 'Execute manifest.operations via Notion MCP, then re-run with results or sync to record mappings.',
    };
  } finally {
    releaseLock(options.cwd);
  }
}
