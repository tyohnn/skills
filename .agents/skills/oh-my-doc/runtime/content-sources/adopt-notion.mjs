import {
  acquireLock,
  createDefaultProject,
  createDefaultState,
  releaseLock,
  writeOmdContract,
} from '../omd-contract.mjs';
import { applyFileOperations } from '../fs-ops.mjs';
import { planSetup } from '../plan-setup.mjs';
import { capabilityBlockers, planProvision, recordResult } from './notion.mjs';
import { parseNotionRoot } from './notion-root.mjs';

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
  const root = parseNotionRoot(options.notionRoot);

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

  // Notion v1 does not scaffold a local Fumadocs mirror or UI vocabulary.
  delete contract.paths.docs;
  delete contract.paths.ui;
  delete contract.paths.content;
  delete contract.paths.templates;
  contract.paths = { notionRoot: planned.manifest.root.rootPageUrl };
  contract.ui = {
    base: 'none',
    distribution: 'none',
    shellDependencies: [],
    vocabulary: [],
  };
  contract.ownership.omdGenerated = ['.omd/project.json', '.omd/schemas/'];
  contract.ownership.omdManaged = ['AGENTS.md', 'CLAUDE.md'];

  const homeMapping = {
    id: root.rootPageId,
    type: 'page',
    parentKey: 'root',
    url: root.rootPageUrl,
  };

  let provider;
  if (options.results) {
    provider = recordResult({
      manifest: planned.manifest,
      manifestDigest: planned.manifestDigest,
      results: options.results,
    });
    provider.notion.mappings['pages.home'] = {
      ...homeMapping,
      ...provider.notion.mappings['pages.home'],
    };
  } else {
    const pendingOperationIds = planned.manifest.operations
      .filter((op) => op.op !== 'map_supplied_root')
      .map((op) => op.id);
    provider = {
      notion: {
        schemaVersion: '1.0',
        schemaDigest: planned.manifestDigest,
        lastObservedAt: new Date().toISOString(),
        lastManifestDigest: planned.manifestDigest,
        mappings: {
          'pages.home': homeMapping,
        },
        pendingOperationIds,
        completedOperationIds: planned.manifest.operations
          .filter((op) => op.op === 'map_supplied_root')
          .map((op) => op.id),
      },
    };
  }

  const state = createDefaultState(contract, { provider });
  const setupPlan = planSetup({ cwd: options.cwd, force: true });

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
      operations: setupPlan.operations,
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
      operations: setupPlan.operations,
      applied: null,
      manualChecklist: planned.manifest.manualChecklist,
    };
  }

  acquireLock(options.cwd);
  try {
    writeOmdContract(options.cwd, contract, state, options.schemasDir);
    const appliedMarkers = applyFileOperations(options.cwd, setupPlan.operations, {
      dryRun: false,
      force: true,
    });
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
      operations: setupPlan.operations,
      applied: {
        wrote: [
          '.omd/project.json',
          '.omd/state.json',
          ...appliedMarkers.applied.map((op) => op.path),
        ],
      },
      manualChecklist: planned.manifest.manualChecklist,
      next: 'Execute manifest.operations via Notion MCP, then re-run with results or sync to record mappings.',
    };
  } finally {
    releaseLock(options.cwd);
  }
}
