/**
 * Shared helpers for docs-app Supabase pull/push scripts.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsRoot = join(__dirname, '..');
const repoRoot = existsSync(join(docsRoot, '../.omd/project.json'))
  ? join(docsRoot, '..')
  : join(docsRoot, '../..');

/**
 * @param {string | null | undefined} handbookId
 */
export function handbookPgSchema(handbookId) {
  if (!handbookId) return 'public';
  const id = String(handbookId);
  if (!/^[a-z][a-z0-9-]{1,62}$/.test(id)) {
    throw new Error(`invalid handbookId: ${id}`);
  }
  return `omd_h_${id.replace(/-/g, '_')}`;
}

/**
 * @returns {{
 *   ssot: string,
 *   projectRef?: string,
 *   schemaVersion?: string,
 *   handbookId?: string,
 *   pgSchema: string,
 * }}
 */
export function readSupabaseContract() {
  const candidates = [
    join(repoRoot, '.omd/project.json'),
    join(docsRoot, '../../.omd/project.json'),
    join(process.cwd(), '.omd/project.json'),
    join(process.cwd(), '../.omd/project.json'),
    join(process.cwd(), '../../.omd/project.json'),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const project = JSON.parse(readFileSync(path, 'utf8'));
    const cs = project.contentSource ?? {};
    const supabase = cs.supabase && typeof cs.supabase === 'object' ? cs.supabase : {};
    const handbookId =
      typeof supabase.handbookId === 'string' && supabase.handbookId
        ? supabase.handbookId
        : undefined;
    return {
      ssot: cs.ssot ?? 'local',
      projectRef: typeof supabase.projectRef === 'string' ? supabase.projectRef : undefined,
      schemaVersion:
        typeof supabase.schemaVersion === 'string' ? supabase.schemaVersion : undefined,
      handbookId,
      pgSchema: handbookPgSchema(handbookId),
    };
  }
  return { ssot: 'local', pgSchema: 'public' };
}

export function restCredentials() {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(
    /\/$/,
    '',
  );
  const key =
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and a publishable/anon key are required');
  }
  return { url, key };
}

/**
 * @param {string} pgSchema
 */
export function restProfileHeaders(pgSchema) {
  if (!pgSchema || pgSchema === 'public') return {};
  return {
    'Accept-Profile': pgSchema,
    'Content-Profile': pgSchema,
  };
}
