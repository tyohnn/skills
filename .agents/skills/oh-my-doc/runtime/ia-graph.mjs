import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const skillRootFromModule = join(dirname(fileURLToPath(import.meta.url)), '..');

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * @param {string} [skillRoot]
 */
export function loadHandbookIaGraph(skillRoot = skillRootFromModule) {
  const path = join(skillRoot, 'references', 'handbook-ia-graph.json');
  if (!existsSync(path)) {
    throw new Error(`missing handbook IA graph: ${path}`);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * @param {ReturnType<typeof loadHandbookIaGraph>} graph
 */
export function sectionsFromGraph(graph) {
  const order = graph.nav.localRootOrder ?? graph.nav.topLevel;
  const byKey = Object.fromEntries(graph.objects.map((o) => [o.key, o]));
  const seen = new Set();
  const sections = [];
  for (const key of order) {
    const obj = byKey[key];
    if (!obj?.localPath) continue;
    const path = obj.localPath === 'index' ? 'index' : obj.localPath.split('/')[0];
    const id = path === 'index' ? 'home' : path;
    if (seen.has(id)) continue;
    seen.add(id);
    sections.push({
      id,
      title: obj.title,
      path,
      required: true,
      visible: true,
    });
  }
  return sections;
}

/**
 * @param {ReturnType<typeof loadHandbookIaGraph>} graph
 */
export function catalogsFromGraph(graph) {
  return graph.objects
    .filter((o) => o.metaRole === 'catalog-index' && o.catalogId && o.localPath)
    .map((o) => ({
      id: o.catalogId,
      label: o.catalogLabel ?? o.title,
      prefix: o.localPath.split('/'),
      indexUrl: o.indexUrl,
      indexOnly: o.indexOnly !== false,
      key: o.key,
      databaseKey: o.databaseKey,
      writeTarget: o.writeTarget,
      documentKinds: o.documentKinds ?? [],
      forbiddenParents: o.forbiddenParents ?? [],
    }));
}

/**
 * @param {ReturnType<typeof loadHandbookIaGraph>} graph
 * @param {string} kind
 */
export function databaseKeyForKind(graph, kind) {
  const mapped = graph.kindToDatabase?.[kind];
  if (mapped) return mapped;
  const hit = graph.objects.find(
    (o) => o.metaRole === 'catalog-index' && (o.documentKinds ?? []).includes(kind),
  );
  return hit?.databaseKey ?? null;
}

/**
 * Build Fumadocs meta.json write ops under a content docs root (relative paths).
 * Catalog detail pages[] are preserved when a meta.json already exists.
 *
 * @param {string} contentRelRoot e.g. docs/content/docs
 * @param {ReturnType<typeof loadHandbookIaGraph>} graph
 * @param {{ readExisting?: (relPath: string) => string | null }} [options]
 */
export function planMetaSkeletonOperations(contentRelRoot, graph, options = {}) {
  const byKey = Object.fromEntries(graph.objects.map((o) => [o.key, o]));
  const ops = [];
  const rootOrder = graph.nav.localRootOrder ?? graph.nav.topLevel;
  const rootPages = rootOrder
    .map((key) => byKey[key])
    .filter((o) => o?.localPath)
    .map((o) => (o.localPath === 'index' ? 'index' : o.localPath.split('/')[0]));
  // unique preserve order
  const uniqueRoot = [...new Set(rootPages)];
  ops.push(
    metaOp(
      `${contentRelRoot}/meta.json`,
      { title: 'Handbook', pages: uniqueRoot },
      options.readExisting,
      'structure',
    ),
  );

  for (const [parentKey, childKeys] of Object.entries(graph.nav.nested ?? {})) {
    const parent = byKey[parentKey];
    if (!parent?.localPath || parent.metaRole !== 'section-folder') continue;
    const childPages = ['index'];
    for (const childKey of childKeys) {
      const child = byKey[childKey];
      if (!child?.localPath) continue;
      const segment = child.localPath.split('/').pop();
      if (segment && !childPages.includes(segment)) childPages.push(segment);
    }
    ops.push(
      metaOp(
        `${contentRelRoot}/${parent.localPath}/meta.json`,
        { title: parent.title, pages: childPages, collapsible: true, defaultOpen: true },
        options.readExisting,
        'structure',
      ),
    );
  }

  for (const catalog of catalogsFromGraph(graph)) {
    const rel = `${contentRelRoot}/${catalog.prefix.join('/')}/meta.json`;
    ops.push(
      metaOp(
        rel,
        { title: catalog.label, pages: ['index'] },
        options.readExisting,
        'catalog',
      ),
    );
  }

  return ops.filter(Boolean);
}

/**
 * @param {string} relPath
 * @param {{ title: string, pages: string[], collapsible?: boolean, defaultOpen?: boolean }} skeleton
 * @param {((relPath: string) => string | null) | undefined} readExisting
 * @param {'structure' | 'catalog'} mode
 */
function metaOp(relPath, skeleton, readExisting, mode) {
  const existingRaw = readExisting?.(relPath) ?? null;
  let content;
  if (existingRaw === null) {
    content = stableStringify(skeleton);
  } else {
    let existing;
    try {
      existing = JSON.parse(existingRaw);
    } catch {
      content = stableStringify(skeleton);
      return {
        path: relPath,
        kind: 'update',
        reason: 'repair invalid meta.json from IA graph',
        content,
      };
    }
    if (mode === 'catalog') {
      const pages = Array.isArray(existing.pages) ? existing.pages : ['index'];
      if (!pages.includes('index')) pages.unshift('index');
      content = stableStringify({
        ...existing,
        title: existing.title ?? skeleton.title,
        pages,
      });
    } else {
      // structure: replace pages order from graph, keep extra unknown keys
      content = stableStringify({
        ...existing,
        title: skeleton.title,
        pages: skeleton.pages,
        ...(skeleton.collapsible !== undefined ? { collapsible: skeleton.collapsible } : {}),
        ...(skeleton.defaultOpen !== undefined ? { defaultOpen: skeleton.defaultOpen } : {}),
      });
    }
  }
  if (existingRaw === content) {
    return { path: relPath, kind: 'skip', reason: 'meta skeleton up to date', content };
  }
  return {
    path: relPath,
    kind: existingRaw === null ? 'create' : 'update',
    reason: mode === 'catalog' ? 'ensure catalog meta skeleton' : 'sync structure meta from IA graph',
    content,
  };
}
