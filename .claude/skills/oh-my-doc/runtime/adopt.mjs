import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { detectProject, listFilesRecursive, relativePosix } from './detect.mjs';
import { applyFileOperations } from './fs-ops.mjs';
import { inspectProject } from './inspect.mjs';
import {
  DEFAULT_AGENTS_MARKER_BODY,
  DEFAULT_CLAUDE_MARKER_BODY,
  mergeMarkerBlock,
} from './markers.mjs';
import {
  acquireLock,
  createDefaultProject,
  createDefaultState,
  digest,
  releaseLock,
  resolveSafePath,
  stableStringify,
  writeOmdContract,
} from './omd-contract.mjs';
import { planInit } from './plan-init.mjs';
import { planSetup } from './plan-setup.mjs';
import { readTextIfExists } from './fs-ops.mjs';

/**
 * Adopt Oh My Docs into a project (greenfield scaffold or brownfield import).
 * @param {{
 *   cwd: string,
 *   templateRoot: string,
 *   skillRoot: string,
 *   schemasDir: string,
 *   uiPath?: string,
 *   packageManager?: string,
 *   dryRun?: boolean,
 *   force?: boolean,
 * }} options
 */
export function adoptProject(options) {
  const inspection = inspectProject({ cwd: options.cwd, uiPath: options.uiPath });
  const project = inspection.project;
  const mode = inspection.mode;

  const initPlan =
    mode === 'greenfield' || !project.docsPath
      ? planInit(
          {
            cwd: project.root,
            force: options.force,
            uiPath: options.uiPath ?? 'packages/ui',
            ...(options.packageManager ? { packageManager: options.packageManager } : {}),
          },
          options.templateRoot,
        )
      : { project, operations: [], conflicts: [] };

  // Ensure UI vocabulary snapshot exists from the skill template.
  const uiOps = planUiSnapshot(project.root, options.templateRoot, options.uiPath ?? 'packages/ui', options.force === true);

  const setupPlan = planSetup({
    cwd: project.root,
    force: options.force,
    agent: 'all',
    scope: 'project',
    skillRoot: options.skillRoot,
  });

  const operations = [...initPlan.operations, ...uiOps, ...setupPlan.operations];
  const conflicts = operations.filter((op) => op.conflict);

  const contract = createDefaultProject(project.root, {
    mode,
    docsPath: project.docsPath ?? 'docs',
    uiPath: options.uiPath ?? project.uiPath ?? 'packages/ui',
  });

  if (mode === 'brownfield' && inspection.documents.length > 0) {
    contract.ownership.importedOwned = inspection.documents.map((doc) => doc.path);
  }

  // Sync IA meta.json for greenfield only.
  if (mode === 'greenfield') {
    const metaPath = `${contract.paths.content}/meta.json`;
    const metaContent = stableStringify({
      title: 'Handbook',
      pages: contract.informationArchitecture.sections.map((section) => section.path),
    });
    operations.push({
      path: metaPath,
      kind: existsSync(join(project.root, metaPath)) ? 'update' : 'create',
      reason: 'write default IA from .omd contract',
      content: metaContent,
    });
  }

  const fileDigests = {};
  for (const op of operations) {
    if (op.content !== undefined && !op.conflict) {
      fileDigests[op.path] = {
        ownership: op.path.startsWith('.omd/') ? 'omd-generated' : 'omd-managed',
        digest: digest(op.content),
      };
    }
  }

  const state = createDefaultState(contract, { files: fileDigests });

  if (options.dryRun) {
    return {
      ok: true,
      dryRun: true,
      mode,
      inspection,
      operations,
      conflicts,
      contract,
      state,
      applied: null,
    };
  }

  acquireLock(project.root);
  try {
    const applied = applyFileOperations(project.root, operations, {
      dryRun: false,
      force: options.force,
    });
    writeOmdContract(project.root, contract, state, options.schemasDir);
    return {
      ok: true,
      dryRun: false,
      mode,
      inspection,
      operations,
      conflicts,
      contract,
      state,
      applied,
    };
  } finally {
    releaseLock(project.root);
  }
}

/**
 * Copy UI vocabulary from the skill template into the consumer project.
 * @param {string} root
 * @param {string} templateRoot
 * @param {string} uiPath
 * @param {boolean} force
 */
function planUiSnapshot(root, templateRoot, uiPath, force) {
  const sourceUi = join(templateRoot, 'packages/ui');
  if (!existsSync(sourceUi)) return [];
  const operations = [];
  for (const absolute of listFilesRecursive(sourceUi)) {
    const rel = relativePosix(sourceUi, absolute);
    const targetRel = `${uiPath.replace(/\\/g, '/')}/${rel}`;
    resolveSafePath(root, targetRel);
    const content = readFileSync(absolute, 'utf8');
    const existing = readTextIfExists(join(root, targetRel));
    if (existing === null) {
      operations.push({ path: targetRel, kind: 'create', reason: 'install UI vocabulary from skill template', content });
    } else if (existing === content) {
      operations.push({ path: targetRel, kind: 'skip', reason: 'UI snapshot up to date', content });
    } else if (force) {
      operations.push({ path: targetRel, kind: 'update', reason: 'refresh UI vocabulary from skill template', content });
    } else {
      operations.push({
        path: targetRel,
        kind: 'skip',
        reason: 'UI file differs from skill template snapshot',
        content,
        conflict: true,
      });
    }
  }
  return operations;
}

/**
 * Sync managed IA meta.json from .omd/project.json without rewriting owned docs.
 * @param {{ cwd: string, force?: boolean, dryRun?: boolean, schemasDir: string }} options
 */
export function syncProject(options) {
  const project = detectProject(options.cwd);
  const contract = createDefaultProject(project.root, {
    mode: existsSync(join(project.root, '.omd/project.json')) ? 'brownfield' : 'greenfield',
    docsPath: project.docsPath ?? 'docs',
    uiPath: project.uiPath ?? 'packages/ui',
  });

  // Prefer existing contract when present.
  const existingPath = join(project.root, '.omd/project.json');
  const contractData = existsSync(existingPath)
    ? JSON.parse(readFileSync(existingPath, 'utf8'))
    : contract;

  const metaPath = `${contractData.paths.content}/meta.json`;
  const pages = contractData.informationArchitecture.sections
    .filter((section) => section.visible !== false)
    .map((section) => section.path);
  const metaContent = stableStringify({
    title: existsSync(join(project.root, metaPath))
      ? JSON.parse(readFileSync(join(project.root, metaPath), 'utf8')).title ?? 'Handbook'
      : 'Handbook',
    pages,
  });

  const operations = [
    {
      path: metaPath,
      kind: existsSync(join(project.root, metaPath)) ? 'update' : 'create',
      reason: 'sync IA pages from .omd/project.json',
      content: metaContent,
    },
  ];

  // Refresh markers (managed).
  for (const [file, body] of [
    ['AGENTS.md', DEFAULT_AGENTS_MARKER_BODY],
    ['CLAUDE.md', DEFAULT_CLAUDE_MARKER_BODY],
  ]) {
    const existing = readTextIfExists(join(project.root, file));
    const merged = mergeMarkerBlock(existing, body, { force: true });
    operations.push({
      path: file,
      kind: merged.kind,
      reason: 'sync managed marker',
      content: merged.content,
    });
  }

  if (options.dryRun) {
    return { ok: true, dryRun: true, operations, contract: contractData, applied: null };
  }

  acquireLock(project.root);
  try {
    const applied = applyFileOperations(project.root, operations, {
      dryRun: false,
      force: options.force ?? true,
    });
    const state = createDefaultState(contractData, {
      files: Object.fromEntries(
        operations
          .filter((op) => op.content)
          .map((op) => [op.path, { ownership: 'omd-managed', digest: digest(op.content) }]),
      ),
    });
    writeOmdContract(project.root, contractData, state, options.schemasDir);
    return { ok: true, dryRun: false, operations, contract: contractData, applied };
  } finally {
    releaseLock(project.root);
  }
}
