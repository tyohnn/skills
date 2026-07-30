#!/usr/bin/env node
/**
 * Push local MDX + catalog meta.json into Supabase (authoritative write helper).
 * Uses the Supabase Management/SQL path via printed SQL, or REST when
 * SUPABASE_SERVICE_ROLE_KEY is set. Default: write SQL batches under
 * `.supabase-content/push/`.
 *
 * Usage (from apps/docs):
 *   node scripts/push-supabase-content.mjs
 */
import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readSupabaseContract } from './supabase-handbook.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsRoot = join(__dirname, '..');
const contentRoot = join(docsRoot, 'content/docs');
const outRoot = join(docsRoot, '.supabase-content/push');

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

/** Minimal frontmatter parse (YAML-ish scalars / JSON values). */
function parseMdx(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: raw.trim() };
  const fm = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('[') && value.endsWith(']')) ||
      (value.startsWith('{') && value.endsWith('}')) ||
      value === 'true' ||
      value === 'false' ||
      value === 'null' ||
      /^-?\d+(\.\d+)?$/.test(value)
    ) {
      try {
        fm[key] = JSON.parse(value);
        continue;
      } catch {
        /* fall through */
      }
    }
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    fm[key] = value;
  }
  return { frontmatter: fm, body: match[2].trim() };
}

function kindFromPath(path, fm) {
  if (typeof fm.kind === 'string') return fm.kind;
  if (path.includes('/prds/') || path.startsWith('planning/prds/')) return 'prd';
  if (path.includes('/stories/')) return 'story';
  if (path.includes('/plans/') || path.startsWith('plans/')) return 'plan';
  if (path.startsWith('adr/')) return 'adr';
  if (path.includes('/glossary/')) return 'term';
  if (path.includes('/models/')) return 'model';
  if (path.includes('/policies/')) return 'policy';
  if (path.includes('spec/')) return 'spec';
  return typeof fm.type === 'string' ? fm.type : 'page';
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function dollarQuote(tag, value) {
  let t = tag;
  let n = 0;
  while (value.includes(`$${t}$`)) {
    n += 1;
    t = `${tag}${n}`;
  }
  return `$${t}$${value}$${t}$`;
}

function qualify(pgSchema, table) {
  if (!pgSchema || pgSchema === 'public') return `public.${table}`;
  return `${pgSchema}.${table}`;
}

function main() {
  const { pgSchema, handbookId } = readSupabaseContract();
  const docsTable = qualify(pgSchema, 'omd_documents');
  const catalogsTable = qualify(pgSchema, 'omd_catalog_meta');
  const files = walk(contentRoot);
  /** @type {Array<Record<string, unknown>>} */
  const documents = [];
  /** @type {Array<{ catalog_key: string, pages: string[] }>} */
  const catalogs = [];

  for (const file of files) {
    const rel = relative(contentRoot, file).replace(/\\/g, '/');
    if (rel.endsWith('meta.json')) {
      const meta = JSON.parse(readFileSync(file, 'utf8'));
      const dir = dirname(rel);
      const catalogKey =
        dir === 'planning/prds'
          ? 'dbs.prds'
          : dir === 'planning/stories'
            ? 'dbs.stories'
            : dir === 'plans'
              ? 'dbs.plans'
              : dir === 'adr'
                ? 'dbs.adrs'
                : dir === 'domain/glossary'
                  ? 'dbs.glossary'
                  : dir === 'domain/models'
                    ? 'dbs.models'
                    : dir === 'domain/policies'
                      ? 'dbs.policies'
                      : dir === 'spec/data-model'
                        ? 'dbs.data-model'
                        : dir === 'spec/system-model'
                          ? 'dbs.system-model'
                          : null;
      if (catalogKey && Array.isArray(meta.pages)) {
        catalogs.push({ catalog_key: catalogKey, pages: meta.pages });
      }
      continue;
    }
    if (extname(file) !== '.mdx') continue;
    const path = rel.replace(/\.mdx$/, '');
    const { frontmatter, body } = parseMdx(readFileSync(file, 'utf8'));
    const id =
      typeof frontmatter.id === 'string' && frontmatter.id
        ? frontmatter.id
        : path.replace(/\//g, '__');
    documents.push({
      id,
      kind: kindFromPath(path, frontmatter),
      ticker: typeof frontmatter.ticker === 'string' ? frontmatter.ticker : null,
      path,
      frontmatter,
      body_mdx: body,
    });
  }

  rmSync(outRoot, { recursive: true, force: true });
  mkdirSync(outRoot, { recursive: true });
  writeFileSync(join(outRoot, 'documents.json'), `${JSON.stringify(documents, null, 2)}\n`);
  writeFileSync(join(outRoot, 'catalogs.json'), `${JSON.stringify(catalogs, null, 2)}\n`);

  const batchSize = 8;
  let batch = 0;
  for (let i = 0; i < documents.length; i += batchSize) {
    const slice = documents.slice(i, i + batchSize);
    const values = slice
      .map((doc) => {
        const fm = sqlString(JSON.stringify(doc.frontmatter));
        const body = dollarQuote('body', String(doc.body_mdx ?? ''));
        const ticker = doc.ticker == null ? 'null' : sqlString(doc.ticker);
        return `(${sqlString(doc.id)}, ${sqlString(doc.kind)}, ${ticker}, ${sqlString(doc.path)}, ${fm}::jsonb, ${body}, now(), now())`;
      })
      .join(',\n');
    const sql = `insert into ${docsTable} (id, kind, ticker, path, frontmatter, body_mdx, created_at, updated_at)
values
${values}
on conflict (id) do update set
  kind = excluded.kind,
  ticker = excluded.ticker,
  path = excluded.path,
  frontmatter = excluded.frontmatter,
  body_mdx = excluded.body_mdx,
  updated_at = now();
`;
    writeFileSync(join(outRoot, `documents-${String(batch).padStart(3, '0')}.sql`), sql);
    batch += 1;
  }

  const catalogSql = catalogs
    .map((c) => {
      const pages = sqlString(JSON.stringify(c.pages));
      return `insert into ${catalogsTable} (catalog_key, pages, updated_at)
values (${sqlString(c.catalog_key)}, ${pages}::jsonb, now())
on conflict (catalog_key) do update set pages = excluded.pages, updated_at = now();`;
    })
    .join('\n\n');
  writeFileSync(join(outRoot, 'catalogs.sql'), `${catalogSql}\n`);

  const scope = handbookId ? `${handbookId} (${pgSchema})` : 'public';
  console.log(
    `Prepared ${documents.length} document(s), ${catalogs.length} catalog(s), ${batch} SQL batch(es) for ${scope} → ${outRoot}`,
  );
}

main();
