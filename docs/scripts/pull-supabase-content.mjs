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
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outRoot = join(__dirname, '../.supabase-content/docs');

function restBase() {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(
    /\/$/,
    '',
  );
  const key =
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required');
  }
  return { url, key };
}

async function restGet(table, query = '') {
  const { url, key } = restBase();
  const response = await fetch(`${url}/rest/v1/${table}${query}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
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
  const lines = Object.entries(fm).map(([key, value]) => {
    if (typeof value === 'string') {
      const needsQuotes = value.includes(':') || value.includes('\n') || value.includes('"');
      return `${key}: ${needsQuotes ? JSON.stringify(value) : value}`;
    }
    return `${key}: ${JSON.stringify(value)}`;
  });
  return `---\n${lines.join('\n')}\n---\n\n${String(doc.body_mdx ?? '').trim()}\n`;
}

async function main() {
  const docs = await restGet(
    'omd_documents',
    '?select=id,kind,ticker,path,frontmatter,body_mdx&order=path.asc',
  );
  const catalogs = await restGet(
    'omd_catalog_meta',
    '?select=catalog_key,pages&order=catalog_key.asc',
  );

  rmSync(outRoot, { recursive: true, force: true });
  mkdirSync(outRoot, { recursive: true });

  for (const doc of docs) {
    const rel = `${doc.path}.mdx`;
    const absolute = join(outRoot, rel);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, documentToMdx(doc), 'utf8');
  }

  // Minimal root meta so Fumadocs can navigate; catalog pages come from rows.
  const rootPages = [...new Set(docs.map((d) => String(d.path).split('/')[0]))];
  writeFileSync(
    join(outRoot, 'meta.json'),
    `${JSON.stringify({ title: 'Handbook', pages: rootPages.length ? rootPages : ['index'] }, null, 2)}\n`,
  );

  for (const catalog of catalogs) {
    // catalog_key like dbs.prds — best-effort path from first matching doc prefix
    const sample = docs.find((d) => Array.isArray(catalog.pages) && catalog.pages.length);
    void sample;
  }

  console.log(
    `Pulled ${docs.length} document(s) and ${catalogs.length} catalog meta row(s) → ${outRoot}`,
  );
  console.log('Build with OMD_CONTENT_DIR=.supabase-content/docs');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
