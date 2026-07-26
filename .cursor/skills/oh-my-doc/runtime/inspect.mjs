import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { detectProject } from './detect.mjs';
import { doctorProject } from './doctor.mjs';
import { hasMarkerBlock } from './markers.mjs';
import { createDefaultProject, digest, omdPaths, readProject, readState, stableStringify } from './omd-contract.mjs';

/**
 * Inspect a repository and classify greenfield vs brownfield.
 * @param {{ cwd: string, uiPath?: string }} options
 */
export function inspectProject(options) {
  const doctor = doctorProject({ cwd: options.cwd, uiPath: options.uiPath });
  const project = detectProject(options.cwd, { uiPath: options.uiPath });
  const omd = omdPaths(project.root);
  const hasOmd = existsSync(omd.project);
  const contract = hasOmd ? readProject(project.root) : null;
  const state = hasOmd ? readState(project.root) : null;

  const mode = classifyMode(project, hasOmd);
  const documents = scanDocuments(project);
  const mapping = proposeBrownfieldMapping(project, documents);

  return {
    ok: true,
    mode,
    doctor,
    project,
    omd: {
      present: hasOmd,
      project: contract,
      state,
      projectDigestMatch: contract && state ? digest(stableStringify(contract)) === state.projectDigest : null,
    },
    documents,
    mapping,
    recommended: mode === 'greenfield' ? ['adopt'] : hasOmd ? ['check', 'sync'] : ['adopt'],
    defaultContract: createDefaultProject(project.root, {
      mode,
      docsPath: project.docsPath ?? 'docs',
      uiPath: options.uiPath ?? project.uiPath ?? 'packages/ui',
    }),
  };
}

/**
 * @param {import('./detect.mjs').detectProject extends Function ? any : never} project
 * @param {boolean} hasOmd
 */
function classifyMode(project, hasOmd) {
  if (project.empty) return 'greenfield';
  if (!project.docsPath && !hasOmd) {
    // Existing code repo without docs → brownfield import
    if (project.hasPackageJson) return 'brownfield';
    return 'greenfield';
  }
  if (project.docsPath) return 'brownfield';
  return hasOmd ? 'brownfield' : 'greenfield';
}

/**
 * @param {{ root: string, docsPath: string | null }} project
 */
function scanDocuments(project) {
  if (!project.docsPath) return [];
  const contentRoot = join(project.root, project.docsPath, 'content/docs');
  if (!existsSync(contentRoot)) return [];
  return walkMdx(contentRoot).map((absolute) => {
    const relative = absolute.slice(contentRoot.length + 1).replaceAll('\\', '/');
    const source = readFileSync(absolute, 'utf8');
    const idMatch = /^id:\s*(.+)$/m.exec(source);
    return {
      path: `${project.docsPath}/content/docs/${relative}`,
      relative,
      id: idMatch?.[1]?.trim() ?? null,
      hasMarker: hasMarkerBlock(source),
    };
  });
}

/**
 * @param {string} directory
 * @returns {string[]}
 */
function walkMdx(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') return [];
      return walkMdx(path);
    }
    return entry.name.endsWith('.mdx') ? [path] : [];
  });
}

/**
 * @param {{ docsPath: string | null, root: string }} project
 * @param {Array<{ path: string, relative: string, id: string | null }>} documents
 */
function proposeBrownfieldMapping(project, documents) {
  if (!project.docsPath) {
    return {
      strategy: 'scaffold-then-import',
      note: 'No docs app detected. adopt will scaffold greenfield skeleton, then mark existing files project-owned.',
      proposals: [],
    };
  }
  return {
    strategy: 'in-place',
    note: 'Existing docs will be imported-owned. IA will not be auto-reordered.',
    proposals: documents.map((doc) => ({
      path: doc.path,
      ownership: 'imported-owned',
      id: doc.id,
    })),
  };
}

/**
 * Lightweight filesystem inventory for sync/check.
 * @param {string} root
 * @param {string} relativeDir
 */
export function listRelativeFiles(root, relativeDir) {
  const absolute = join(root, relativeDir);
  if (!existsSync(absolute) || !statSync(absolute).isDirectory()) return [];
  return walkAll(absolute).map((path) => path.slice(absolute.length + 1).replaceAll('\\', '/'));
}

/**
 * @param {string} directory
 * @returns {string[]}
 */
function walkAll(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') return [];
      return walkAll(path);
    }
    return [path];
  });
}
