import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const CONTRACT_VERSION = '1.0';
export const SKILL_VERSION = '0.2.0';

/** Default IA: Home → Vision → Start here → Workflow → Planning → Plans → ADR → Spec */
export const DEFAULT_IA_SECTIONS = [
  { id: 'home', title: 'Home', path: 'index', required: true, visible: true },
  { id: 'vision', title: 'Vision', path: 'vision', required: true, visible: true },
  { id: 'starting', title: 'Start here', path: 'starting', required: true, visible: true },
  { id: 'workflow', title: 'Workflow', path: 'workflow', required: true, visible: true },
  { id: 'planning', title: 'Planning', path: 'planning', required: true, visible: true },
  { id: 'plans', title: 'Plans', path: 'plans', required: true, visible: true },
  { id: 'adr', title: 'ADR', path: 'adr', required: true, visible: true },
  { id: 'spec', title: 'Spec', path: 'spec', required: true, visible: true },
];


export const DEFAULT_CATALOGS = [
  { id: 'glossary', label: 'Glossary', prefix: ['domain', 'glossary'], indexUrl: '/docs/domain/glossary', indexOnly: true },
  { id: 'models', label: 'Domain models', prefix: ['domain', 'models'], indexUrl: '/docs/domain/models', indexOnly: true },
  { id: 'policies', label: 'Domain policies', prefix: ['domain', 'policies'], indexUrl: '/docs/domain/policies', indexOnly: true },
  { id: 'prds', label: 'Product requirements', prefix: ['planning', 'prds'], indexUrl: '/docs/planning/prds', indexOnly: true },
  { id: 'stories', label: 'User stories', prefix: ['planning', 'stories'], indexUrl: '/docs/planning/stories', indexOnly: true },
  { id: 'plans', label: 'Implementation plans', prefix: ['plans'], indexUrl: '/docs/plans', indexOnly: true },
  { id: 'adr', label: 'ADR', prefix: ['adr'], indexUrl: '/docs/adr', indexOnly: true },
  { id: 'spec-data-model', label: 'Data model', prefix: ['spec', 'data-model'], indexUrl: '/docs/spec/data-model', indexOnly: true },
  { id: 'spec-system-model', label: 'System model', prefix: ['spec', 'system-model'], indexUrl: '/docs/spec/system-model', indexOnly: true },
];

export const DEFAULT_UI_VOCABULARY = [
  { name: 'Card', surface: 'fumadocs-mdx', export: 'Card', source: 'fumadocs-ui', contractVersion: CONTRACT_VERSION },
  { name: 'Cards', surface: 'fumadocs-mdx', export: 'Cards', source: 'fumadocs-ui', contractVersion: CONTRACT_VERSION },
  { name: 'File', surface: 'fumadocs-mdx', export: 'File', source: 'fumadocs-ui', contractVersion: CONTRACT_VERSION },
  { name: 'Files', surface: 'fumadocs-mdx', export: 'Files', source: 'fumadocs-ui', contractVersion: CONTRACT_VERSION },
  { name: 'Folder', surface: 'fumadocs-mdx', export: 'Folder', source: 'fumadocs-ui', contractVersion: CONTRACT_VERSION },
  { name: 'DocKind', surface: 'planning-badge', export: 'DocKind', contractVersion: CONTRACT_VERSION, enums: { kind: ['PRD', 'US', 'PLAN', 'SPEC', 'ADR'] } },
  { name: 'DocStatus', surface: 'planning-badge', export: 'DocStatus', contractVersion: CONTRACT_VERSION, enums: { status: ['draft', 'accepted', 'ready', 'active', 'done', 'superseded'] } },
  { name: 'AdrStatus', surface: 'planning-badge', export: 'AdrStatus', contractVersion: CONTRACT_VERSION, enums: { status: ['accepted', 'locked', 'superseded'] } },
  { name: 'Decision', surface: 'decision-block', export: 'Decision', contractVersion: CONTRACT_VERSION },
  { name: 'SpecVersion', surface: 'spec-block', export: 'SpecVersion', contractVersion: CONTRACT_VERSION },
  { name: 'Canvas', surface: 'visual-block', export: 'Canvas', contractVersion: CONTRACT_VERSION, enums: { nodeKind: ['input', 'process', 'output', 'external'] } },
  { name: 'CanvasLegend', surface: 'visual-block', export: 'CanvasLegend', contractVersion: CONTRACT_VERSION },
  { name: 'DocsInlineToc', surface: 'navigation-shell', export: 'DocsInlineToc', contractVersion: CONTRACT_VERSION },
  { name: 'DocsSidebarFolder', surface: 'navigation-shell', export: 'DocsSidebarFolder', contractVersion: CONTRACT_VERSION },
  { name: 'indexOnlyPageTree', surface: 'catalog-helper', export: 'indexOnlyPageTree', contractVersion: CONTRACT_VERSION },
  { name: 'createCatalogNavigation', surface: 'catalog-helper', export: 'createCatalogNavigation', contractVersion: CONTRACT_VERSION },
];

export const DEFAULT_LIFECYCLES = {
  prd: { field: 'status', values: ['draft', 'active', 'done'] },
  story: { field: null, values: [] },
  spec: { field: 'stage', values: ['draft', 'accepted', 'superseded'] },
  adr: { field: 'stage', values: ['accepted', 'locked', 'superseded'] },
  plan: { field: 'stage', values: ['draft', 'ready', 'active', 'done', 'superseded'] },
};

/**
 * @param {string} content
 */
export function digest(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * @param {unknown} value
 */
export function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * @param {string} root
 * @param {{ mode?: 'greenfield' | 'brownfield', docsPath?: string, uiPath?: string }} [options]
 */
/**
 * @param {unknown} project
 * @returns {{ ssot: 'local' | 'notion', notion: null | { rootPageId: string, rootPageUrl: string, schemaVersion: string } }}
 */
export function normalizeContentSource(project) {
  const raw = project && typeof project === 'object' ? project.contentSource : null;
  if (!raw || typeof raw !== 'object' || !raw.ssot) {
    return { ssot: 'local', notion: null };
  }
  if (raw.ssot === 'local') {
    return { ssot: 'local', notion: null };
  }
  if (raw.ssot === 'notion') {
    const notion = raw.notion && typeof raw.notion === 'object' ? raw.notion : {};
    return {
      ssot: 'notion',
      notion: {
        rootPageId: String(notion.rootPageId ?? ''),
        rootPageUrl: String(notion.rootPageUrl ?? ''),
        schemaVersion: String(notion.schemaVersion ?? '1.0'),
      },
    };
  }
  throw new Error(`unsupported contentSource.ssot: ${raw.ssot}`);
}

/**
 * @param {'local' | 'notion'} [ssot]
 * @param {{ rootPageId: string, rootPageUrl: string, schemaVersion?: string } | null} [notion]
 */
export function createContentSource(ssot = 'local', notion = null) {
  if (ssot === 'local') {
    return { ssot: 'local' };
  }
  if (ssot === 'notion') {
    if (!notion?.rootPageId || !notion?.rootPageUrl) {
      throw new Error('notion contentSource requires rootPageId and rootPageUrl');
    }
    return {
      ssot: 'notion',
      notion: {
        rootPageId: notion.rootPageId,
        rootPageUrl: notion.rootPageUrl,
        schemaVersion: notion.schemaVersion ?? '1.0',
      },
    };
  }
  throw new Error(`unsupported contentSource.ssot: ${ssot}`);
}

/**
 * @param {string} root
 * @param {{
 *   mode?: 'greenfield' | 'brownfield',
 *   docsPath?: string,
 *   uiPath?: string,
 *   contentSource?: { ssot: 'local' | 'notion', notion?: { rootPageId: string, rootPageUrl: string, schemaVersion?: string } },
 * }} [options]
 */
export function createDefaultProject(root, options = {}) {
  const contentSource = options.contentSource
    ? createContentSource(
        options.contentSource.ssot,
        options.contentSource.ssot === 'notion' ? options.contentSource.notion ?? null : null,
      )
    : createContentSource('local');

  return {
    contractVersion: CONTRACT_VERSION,
    mode: options.mode ?? 'greenfield',
    contentSource,
    paths: {
      docs: options.docsPath ?? 'docs',
      ui: options.uiPath ?? 'packages/ui',
      content: `${options.docsPath ?? 'docs'}/content/docs`,
      templates: `${options.docsPath ?? 'docs'}/templates`,
    },
    informationArchitecture: {
      sections: DEFAULT_IA_SECTIONS,
      catalogs: DEFAULT_CATALOGS,
    },
    lifecycles: DEFAULT_LIFECYCLES,
    ui: {
      base: 'fumadocs',
      distribution: 'skill-template',
      shellDependencies: ['fumadocs-ui', 'fumadocs-core', 'fumadocs-mdx'],
      vocabulary: DEFAULT_UI_VOCABULARY,
    },
    ownership: {
      omdGenerated: ['.omd/project.json', '.omd/schemas/', `${options.docsPath ?? 'docs'}/content/docs/meta.json`],
      omdManaged: ['AGENTS.md', 'CLAUDE.md'],
      importedOwned: [],
      projectOwned: [],
    },
  };
}

/**
 * @param {ReturnType<typeof createDefaultProject>} project
 * @param {{ skillVersion?: string, templateVersion?: string, files?: Record<string, { ownership: string, digest: string }> }} [options]
 */
/**
 * @param {ReturnType<typeof createDefaultProject>} project
 * @param {{
 *   skillVersion?: string,
 *   templateVersion?: string,
 *   files?: Record<string, { ownership: string, digest: string }>,
 *   provider?: Record<string, unknown>,
 * }} [options]
 */
export function createDefaultState(project, options = {}) {
  const contentSource = normalizeContentSource(project);
  return {
    contractVersion: CONTRACT_VERSION,
    skillVersion: options.skillVersion ?? SKILL_VERSION,
    templateVersion: options.templateVersion ?? SKILL_VERSION,
    uiSnapshot: {
      distribution: project.ui.distribution,
      vocabularyDigest: digest(stableStringify(project.ui.vocabulary)),
    },
    projectDigest: digest(stableStringify(project)),
    inventory: {
      sections: project.informationArchitecture.sections.map((section) => section.id),
      catalogs: project.informationArchitecture.catalogs.map((catalog) => catalog.id),
      vocabulary: project.ui.vocabulary.map((item) => item.name),
      contentSource: contentSource.ssot,
    },
    files: options.files ?? {},
    ...(options.provider ? { provider: options.provider } : {}),
  };
}

/**
 * @param {string} root
 */
export function omdPaths(root) {
  const dir = join(root, '.omd');
  return {
    dir,
    project: join(dir, 'project.json'),
    state: join(dir, 'state.json'),
    lock: join(dir, '.lock'),
    schemas: join(dir, 'schemas'),
  };
}

/**
 * @param {string} root
 */
export function readProject(root) {
  const path = omdPaths(root).project;
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * @param {string} root
 */
export function readState(root) {
  const path = omdPaths(root).state;
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * Acquire a simple lock file. Throws if already locked.
 * @param {string} root
 */
export function acquireLock(root) {
  const { dir, lock } = omdPaths(root);
  mkdirSync(dir, { recursive: true });
  if (existsSync(lock)) {
    throw new Error(`.omd/.lock exists — another Oh My Docs operation may be in progress`);
  }
  writeFileSync(lock, `${process.pid}\n${new Date().toISOString()}\n`, 'utf8');
}

/**
 * @param {string} root
 */
export function releaseLock(root) {
  const { lock } = omdPaths(root);
  if (existsSync(lock)) rmSync(lock, { force: true });
}

/**
 * Write .omd contract files atomically after apply.
 * @param {string} root
 * @param {ReturnType<typeof createDefaultProject>} project
 * @param {ReturnType<typeof createDefaultState>} state
 * @param {string} schemasDir absolute path to skill schemas
 */
export function writeOmdContract(root, project, state, schemasDir) {
  const paths = omdPaths(root);
  mkdirSync(paths.schemas, { recursive: true });
  const projectText = stableStringify(project);
  const stateText = stableStringify({ ...state, projectDigest: digest(projectText) });
  writeAtomic(paths.project, projectText);
  writeAtomic(paths.state, stateText);
  for (const name of ['project-1.0.schema.json', 'state-1.0.schema.json']) {
    const source = join(schemasDir, name);
    if (existsSync(source)) {
      writeAtomic(join(paths.schemas, name), readFileSync(source, 'utf8'));
    }
  }
}

/**
 * @param {string} path
 * @param {string} content
 */
function writeAtomic(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, content, 'utf8');
  renameSync(temp, path);
}

/**
 * Resolve and validate a repo-relative POSIX path (no traversal).
 * @param {string} root
 * @param {string} relativePath
 */
export function resolveSafePath(root, relativePath) {
  const normalized = relativePath.replaceAll('\\', '/');
  if (normalized.startsWith('/') || normalized.includes('\0') || normalized.split('/').includes('..')) {
    throw new Error(`unsafe path rejected: ${relativePath}`);
  }
  const absolute = resolve(root, normalized);
  const rootResolved = resolve(root);
  if (absolute !== rootResolved && !absolute.startsWith(`${rootResolved}/`)) {
    throw new Error(`path escapes project root: ${relativePath}`);
  }
  return { absolute, relative: normalized };
}
