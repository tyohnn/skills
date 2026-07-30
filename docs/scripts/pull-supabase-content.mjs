#!/usr/bin/env node
/**
 * Materialize Supabase handbook rows into a local cache directory for Fumadocs.
 * Cache is non-authoritative — SSOT remains Supabase.
 *
 * Usage (from apps/docs):
 *   node scripts/pull-supabase-content.mjs
 *
 * Then build/dev with:
 *   OMD_CONTENT_DIR=.supabase-content/docs pnpm dev
 */
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readSupabaseContract, restCredentials, restProfileHeaders } from './supabase-handbook.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsRoot = join(__dirname, '..');
const repoRoot = existsSync(join(docsRoot, '../.omd/project.json'))
  ? join(docsRoot, '..')
  : join(docsRoot, '../..');
const outRoot = join(docsRoot, '.supabase-content/docs');

const CATALOG_DIRS = {
  'dbs.prds': 'planning/prds',
  'dbs.stories': 'planning/stories',
  'dbs.plans': 'plans',
  'dbs.adrs': 'adr',
  'dbs.glossary': 'domain/glossary',
  'dbs.models': 'domain/models',
  'dbs.policies': 'domain/policies',
  'dbs.data-model': 'spec/data-model',
  'dbs.system-model': 'spec/system-model',
};

/** @type {Record<string, { layout: 'status-table' | 'title-table' | 'list'; statusKey?: string; empty: string }>} */
const CATALOG_INDEX_LAYOUT = {
  'dbs.prds': {
    layout: 'status-table',
    statusKey: 'status',
    empty: 'Add PRDs beside this index and register each slug in `meta.json`.',
  },
  'dbs.stories': {
    layout: 'title-table',
    empty: 'Add stories beside this index and register each slug in `meta.json`.',
  },
  'dbs.plans': {
    layout: 'status-table',
    statusKey: 'stage',
    empty: 'Add plans beside this index and register each slug in `meta.json`.',
  },
  'dbs.adrs': {
    layout: 'status-table',
    statusKey: 'stage',
    empty: 'Add ADRs beside this index and register each slug in `meta.json`.',
  },
  'dbs.glossary': {
    layout: 'list',
    empty: 'Add entries beside this index and register each slug in `meta.json`.',
  },
  'dbs.models': {
    layout: 'list',
    empty: 'Add entries beside this index and register each slug in `meta.json`.',
  },
  'dbs.policies': {
    layout: 'list',
    empty: 'Add entries beside this index and register each slug in `meta.json`.',
  },
  'dbs.data-model': {
    layout: 'list',
    empty:
      'Add detail pages beside this index and register each slug in `meta.json`.\nChildren stay out of the sidebar.',
  },
  'dbs.system-model': {
    layout: 'list',
    empty:
      'Add detail pages beside this index and register each slug in `meta.json`.\nChildren stay out of the sidebar.',
  },
};

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * @param {any} doc
 */
function catalogEntryLabel(doc) {
  const fm = doc?.frontmatter && typeof doc.frontmatter === 'object' ? doc.frontmatter : {};
  return String(doc?.ticker || fm.ticker || fm.id || doc?.id || '').trim();
}

/**
 * @param {any} doc
 */
function catalogEntryTitle(doc) {
  const fm = doc?.frontmatter && typeof doc.frontmatter === 'object' ? doc.frontmatter : {};
  return String(fm.title || catalogEntryLabel(doc) || 'Untitled').trim();
}

/**
 * @param {any} doc
 * @param {string} [statusKey]
 */
function catalogEntryStatus(doc, statusKey = 'status') {
  const fm = doc?.frontmatter && typeof doc.frontmatter === 'object' ? doc.frontmatter : {};
  return String(fm[statusKey] || fm.status || fm.stage || '').trim();
}

/**
 * Build catalog index body MDX from detail documents (sidebar still uses meta.json).
 *
 * @param {string} catalogKey
 * @param {string} dir
 * @param {string[]} pages
 * @param {Array<{ id?: string, path?: string, ticker?: string, frontmatter?: Record<string, any> }>} docs
 */
export function buildCatalogIndexBody(catalogKey, dir, pages, docs) {
  const layout = CATALOG_INDEX_LAYOUT[catalogKey] ?? {
    layout: 'list',
    empty: 'Add entries beside this index and register each slug in `meta.json`.',
  };
  const detailSlugs = (Array.isArray(pages) ? pages : []).filter((p) => p && p !== 'index');
  const bySlug = new Map();
  for (const doc of docs) {
    if (!doc?.path || !String(doc.path).startsWith(`${dir}/`)) continue;
    const slug = String(doc.path).slice(dir.length + 1);
    if (!slug || slug === 'index' || slug.includes('/')) continue;
    bySlug.set(slug, doc);
  }
  const entries = detailSlugs
    .map((slug) => {
      const doc = bySlug.get(slug);
      if (!doc) return null;
      return { slug, doc };
    })
    .filter(Boolean);

  if (entries.length === 0) {
    if (layout.layout === 'list') return `${layout.empty}\n`;
    const colSpan = layout.layout === 'title-table' ? 2 : 3;
    const headers =
      layout.layout === 'title-table'
        ? `        <th className="py-2 pr-4 font-medium">ID</th>
        <th className="py-2 font-medium">Title</th>`
        : `        <th className="py-2 pr-4 font-medium">ID</th>
        <th className="py-2 pr-4 font-medium">Status</th>
        <th className="py-2 font-medium">Title</th>`;
    return `<div className="not-prose overflow-x-auto">
  <table className="w-full text-sm">
    <thead>
      <tr className="border-b text-left">
${headers}
      </tr>
    </thead>
    <tbody>
      <tr className="border-b border-fd-border/60">
        <td className="py-3 pr-4 text-fd-muted-foreground" colSpan={${colSpan}}>
          ${layout.empty}
        </td>
      </tr>
    </tbody>
  </table>
</div>
`;
  }

  if (layout.layout === 'list') {
    const lines = entries.map(({ slug, doc }) => {
      const id = catalogEntryLabel(doc);
      const title = catalogEntryTitle(doc);
      const href = `/docs/${dir}/${slug}`;
      return `- [${id || title}](${href})${id && title !== id ? ` — ${title}` : ''}`;
    });
    return `${lines.join('\n')}\n`;
  }

  if (layout.layout === 'title-table') {
    const rows = entries
      .map(({ slug, doc }) => {
        const id = escapeHtml(catalogEntryLabel(doc));
        const title = escapeHtml(catalogEntryTitle(doc));
        const href = `/docs/${dir}/${slug}`;
        return `      <tr className="border-b border-fd-border/60">
        <td className="py-3 pr-4 font-mono text-xs"><a href="${href}">${id}</a></td>
        <td className="py-3"><a href="${href}">${title}</a></td>
      </tr>`;
      })
      .join('\n');
    return `<div className="not-prose overflow-x-auto">
  <table className="w-full text-sm">
    <thead>
      <tr className="border-b text-left">
        <th className="py-2 pr-4 font-medium">ID</th>
        <th className="py-2 font-medium">Title</th>
      </tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
</div>
`;
  }

  const rows = entries
    .map(({ slug, doc }) => {
      const id = escapeHtml(catalogEntryLabel(doc));
      const status = escapeHtml(catalogEntryStatus(doc, layout.statusKey));
      const title = escapeHtml(catalogEntryTitle(doc));
      const href = `/docs/${dir}/${slug}`;
      return `      <tr className="border-b border-fd-border/60">
        <td className="py-3 pr-4 font-mono text-xs"><a href="${href}">${id}</a></td>
        <td className="py-3 pr-4">${status}</td>
        <td className="py-3"><a href="${href}">${title}</a></td>
      </tr>`;
    })
    .join('\n');
  return `<div className="not-prose overflow-x-auto">
  <table className="w-full text-sm">
    <thead>
      <tr className="border-b text-left">
        <th className="py-2 pr-4 font-medium">ID</th>
        <th className="py-2 pr-4 font-medium">Status</th>
        <th className="py-2 font-medium">Title</th>
      </tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
</div>
`;
}

/**
 * Rewrite catalog index document bodies from catalog meta + detail rows.
 *
 * @param {Array<{ id?: string, path?: string, ticker?: string, frontmatter?: Record<string, any>, body_mdx?: string }>} docs
 * @param {Array<{ catalog_key: string, pages: string[] }>} catalogs
 */
export function applyCatalogIndexBodies(docs, catalogs) {
  const byPath = new Map(docs.map((doc) => [doc.path, doc]));
  for (const catalog of catalogs) {
    const dir = CATALOG_DIRS[catalog.catalog_key];
    if (!dir) continue;
    const indexPath = `${dir}/index`;
    const indexDoc = byPath.get(indexPath);
    if (!indexDoc) continue;
    indexDoc.body_mdx = buildCatalogIndexBody(
      catalog.catalog_key,
      dir,
      catalog.pages,
      docs,
    );
  }
  return docs;
}

/**
 * @param {string} repoRootPath
 */
export function loadHandbookIa(repoRootPath = repoRoot) {
  const candidates = [
    join(repoRootPath, '.agents/skills/oh-my-doc/references/handbook-ia-graph.json'),
    join(repoRootPath, 'skills/oh-my-doc/references/handbook-ia-graph.json'),
    join(repoRootPath, '.omd/project.json'),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    if (path.endsWith('project.json')) {
      return {
        objects: [],
        nav: raw.informationArchitecture?.nav ?? {},
        fromProject: true,
        sections: raw.informationArchitecture?.sections ?? [],
        catalogs: raw.informationArchitecture?.catalogs ?? [],
      };
    }
    return { objects: raw.objects ?? [], nav: raw.nav ?? {}, fromProject: false };
  }
  return { objects: [], nav: {}, fromProject: false };
}

/**
 * Build root + section meta.json payloads from handbook IA.
 * Catalog leaf metas are written separately from omd_catalog_meta rows.
 *
 * @param {{ objects?: any[], nav?: any, fromProject?: boolean, sections?: any[], catalogs?: any[] }} ia
 */
export function buildSectionMetas(ia) {
  /** @type {Map<string, { title: string, pages: string[], collapsible?: boolean, defaultOpen?: boolean }>} */
  const metas = new Map();

  if (ia.fromProject) {
    const sections = Array.isArray(ia.sections) ? ia.sections : [];
    const byId = new Map(sections.map((s) => [s.id, s]));
    const rootOrder = (ia.nav?.localRootOrder ?? ia.nav?.topLevel ?? [])
      .map((key) => String(key).replace(/^pages\./, ''))
      .map((id) => (id === 'home' ? 'index' : id === 'adrs' ? 'adr' : id));
    const rootPages = rootOrder.filter((id) => id === 'index' || byId.has(id) || id === 'adr');
    metas.set('', {
      title: 'Handbook',
      pages: rootPages.length ? rootPages : ['index'],
    });

    const nested = ia.nav?.nested ?? {};
    for (const [parentKey, childKeys] of Object.entries(nested)) {
      const parentId = String(parentKey).replace(/^pages\./, '');
      const parent = byId.get(parentId);
      const dir = parentId === 'adrs' ? 'adr' : parentId;
      const childPages = (Array.isArray(childKeys) ? childKeys : []).map((key) => {
        const id = String(key).replace(/^pages\./, '');
        if (id.startsWith(`${parentId}-`)) return id.slice(parentId.length + 1);
        if (id === 'workflow-planning') return 'planning';
        return id.includes('/') ? id.split('/').pop() : id;
      });
      // Section indexes stay in pages; catalog folders are children.
      const pages = ['index', ...childPages.filter((p) => p && p !== 'index')];
      const unique = [...new Set(pages)];
      metas.set(dir, {
        title: parent?.title ?? dir,
        pages: unique,
        ...(dir === 'spec' ? { collapsible: true, defaultOpen: true } : {}),
      });
    }
    return metas;
  }

  const objects = Array.isArray(ia.objects) ? ia.objects : [];
  const byKey = new Map(objects.map((o) => [o.key, o]));
  const pathOf = (key) => {
    const obj = byKey.get(key);
    if (!obj?.localPath) return undefined;
    return obj.localPath === 'index' ? '' : String(obj.localPath);
  };
  const leafName = (key) => {
    const path = pathOf(key);
    if (!path) return undefined;
    return path.includes('/') ? path.split('/').pop() : path;
  };

  const rootKeys = ia.nav?.localRootOrder ?? ia.nav?.topLevel ?? [];
  const rootPages = rootKeys
    .map((key) => {
      const path = pathOf(key);
      if (path === '') return 'index';
      if (!path) return undefined;
      return path.includes('/') ? undefined : path;
    })
    .filter(Boolean);
  metas.set('', {
    title: 'Handbook',
    pages: rootPages.length ? /** @type {string[]} */ (rootPages) : ['index'],
  });

  const nested = ia.nav?.nested ?? {};
  for (const [parentKey, childKeys] of Object.entries(nested)) {
    const parent = byKey.get(parentKey);
    const dir = pathOf(parentKey);
    if (!dir || dir.includes('/')) continue;
    const childPages = (Array.isArray(childKeys) ? childKeys : [])
      .map((key) => leafName(key))
      .filter(Boolean);
    const pages = ['index', ...childPages.filter((p) => p !== 'index')];
    metas.set(dir, {
      title: parent?.title ?? dir,
      pages: [...new Set(pages)],
      ...(dir === 'spec' ? { collapsible: true, defaultOpen: true } : {}),
    });
  }

  // Workflow has no section index in local IA; keep children only.
  if (metas.has('workflow')) {
    const workflow = metas.get('workflow');
    workflow.pages = workflow.pages.filter((p) => p !== 'index');
    if (workflow.pages.length === 0) metas.delete('workflow');
  }

  return metas;
}

/**
 * Catalog meta for Fumadocs: keep detail pages, omit `index` so folder.index
 * stays set (listing `index` in pages deletes folder.index and breaks
 * index-only sidebar collapse).
 *
 * @param {string[]} pages
 * @param {string} title
 */
export function catalogMetaPayload(pages, title) {
  const detailPages = (Array.isArray(pages) ? pages : []).filter((p) => p && p !== 'index');
  return { title, pages: detailPages };
}

/**
 * @param {{ objects?: any[] }} ia
 * @param {string} catalogKey
 * @param {string} dir
 */
export function catalogTitle(ia, catalogKey, dir) {
  const objects = Array.isArray(ia.objects) ? ia.objects : [];
  const match = objects.find(
    (o) => o.metaRole === 'catalog-index' && o.databaseKey === catalogKey,
  );
  if (match?.catalogLabel || match?.title) return match.catalogLabel ?? match.title;
  const fallback = dir.split('/').at(-1) ?? catalogKey;
  return fallback;
}

async function restGet(table, query = '') {
  const { url, key } = restCredentials();
  const { pgSchema } = readSupabaseContract();
  const response = await fetch(`${url}/rest/v1/${table}${query}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      ...restProfileHeaders(pgSchema),
    },
  });
  if (!response.ok) {
    throw new Error(`${table}: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

function documentToMdx(doc) {
  const fm = { ...(doc.frontmatter ?? {}) };
  if (!fm.id) fm.id = doc.id;
  if (doc.ticker && !fm.ticker) fm.ticker = doc.ticker;
  const lines = Object.entries(fm)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => {
      if (typeof value === 'string') {
        const needsQuotes = value.includes(':') || value.includes('\n') || value.includes('"');
        return `${key}: ${needsQuotes ? JSON.stringify(value) : value}`;
      }
      return `${key}: ${JSON.stringify(value)}`;
    });
  return `---\n${lines.join('\n')}\n---\n\n${String(doc.body_mdx ?? '').trim()}\n`;
}

function writeMeta(relativeDir, payload) {
  const absolute = relativeDir ? join(outRoot, relativeDir, 'meta.json') : join(outRoot, 'meta.json');
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function main() {
  const { handbookId, pgSchema } = readSupabaseContract();
  const docs = await restGet(
    'omd_documents',
    '?select=id,kind,ticker,path,frontmatter,body_mdx&order=path.asc',
  );
  const catalogs = await restGet(
    'omd_catalog_meta',
    '?select=catalog_key,pages&order=catalog_key.asc',
  );

  applyCatalogIndexBodies(docs, catalogs);

  rmSync(outRoot, { recursive: true, force: true });
  mkdirSync(outRoot, { recursive: true });

  for (const doc of docs) {
    const rel = `${doc.path}.mdx`;
    const absolute = join(outRoot, rel);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, documentToMdx(doc), 'utf8');
  }

  const ia = loadHandbookIa();
  for (const [dir, payload] of buildSectionMetas(ia)) {
    writeMeta(dir, payload);
  }

  for (const catalog of catalogs) {
    const dir = CATALOG_DIRS[catalog.catalog_key];
    if (!dir || !Array.isArray(catalog.pages)) continue;
    writeMeta(
      dir,
      catalogMetaPayload(catalog.pages, catalogTitle(ia, catalog.catalog_key, dir)),
    );
  }

  const scope = handbookId ? `${handbookId} (${pgSchema})` : 'public';
  console.log(
    `Pulled ${docs.length} document(s) and ${catalogs.length} catalog meta row(s) from ${scope} → ${outRoot}`,
  );
  console.log('Build with OMD_CONTENT_DIR=.supabase-content/docs');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
