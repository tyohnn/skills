/**
 * Remote handbook loader for `contentSource.ssot: supabase`.
 * Uses PostgREST (no service_role). Publishable URL + anon/publishable key
 * come from environment — never from `.omd` JSON.
 */

export type SupabaseHandbookDocument = {
  id: string;
  kind: string;
  ticker: string | null;
  path: string;
  frontmatter: Record<string, unknown>;
  body_mdx: string;
};

export type SupabaseCatalogMeta = {
  catalog_key: string;
  pages: string[];
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is required for Supabase handbook reads. Set it in the environment (not in .omd).`,
    );
  }
  return value;
}

function restBase(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL and a publishable/anon key (SUPABASE_* or NEXT_PUBLIC_*) are required for remote handbook reads.',
    );
  }
  return { url: url.replace(/\/$/, ''), key };
}

async function restGet<T>(table: string, query = ''): Promise<T[]> {
  const { url, key } = restBase();
  const response = await fetch(`${url}/rest/v1/${table}${query}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Supabase REST ${table} failed: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as T[];
}

export async function fetchSupabaseDocuments(): Promise<SupabaseHandbookDocument[]> {
  return restGet<SupabaseHandbookDocument>(
    'omd_documents',
    '?select=id,kind,ticker,path,frontmatter,body_mdx&order=path.asc',
  );
}

export async function fetchSupabaseCatalogMeta(): Promise<SupabaseCatalogMeta[]> {
  return restGet<SupabaseCatalogMeta>(
    'omd_catalog_meta',
    '?select=catalog_key,pages&order=catalog_key.asc',
  );
}

/**
 * Serialize a document row to MDX with YAML frontmatter for Fumadocs.
 */
export function documentToMdx(doc: SupabaseHandbookDocument): string {
  const fm = { ...doc.frontmatter };
  if (!fm.id) fm.id = doc.id;
  if (doc.ticker && !fm.ticker) fm.ticker = doc.ticker;
  const lines = Object.entries(fm).map(([key, value]) => {
    if (typeof value === 'string') {
      const needsQuotes = value.includes(':') || value.includes('\n') || value.includes('"');
      return `${key}: ${needsQuotes ? JSON.stringify(value) : value}`;
    }
    return `${key}: ${JSON.stringify(value)}`;
  });
  return `---\n${lines.join('\n')}\n---\n\n${doc.body_mdx.trim()}\n`;
}

export function supabaseProjectRefFromEnv(): string | undefined {
  try {
    return process.env.SUPABASE_PROJECT_REF ?? requireEnv('SUPABASE_PROJECT_REF');
  } catch {
    return process.env.SUPABASE_PROJECT_REF;
  }
}
