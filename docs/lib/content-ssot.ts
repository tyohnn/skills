import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type ContentSsot = 'local' | 'notion' | 'supabase';

export type ContentSourceContract = {
  ssot: ContentSsot;
  supabase?: { projectRef: string; schemaVersion: string; handbookId?: string };
  notion?: { rootPageId: string; rootPageUrl: string; schemaVersion: string };
};

function resolveProjectJson(): string | null {
  const candidates = [
    join(process.cwd(), '.omd/project.json'),
    join(process.cwd(), '../.omd/project.json'),
    join(process.cwd(), '../../.omd/project.json'),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return null;
}

/** True when Vercel↔Supabase Connect (or local .env) provides publishable REST access. */
export function hasSupabaseConnectEnv(): boolean {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return Boolean(url && key);
}

/**
 * Read handbook SSOT from repo-root `.omd/project.json`.
 * Missing contract ⇒ local (legacy). SSOT is chosen at adopt time — not via
 * a Vercel `OMD_CONTENT_SSOT` env.
 */
export function readContentSource(): ContentSourceContract {
  const path = resolveProjectJson();
  if (!path) return { ssot: 'local' };
  const project = JSON.parse(readFileSync(path, 'utf8')) as {
    contentSource?: ContentSourceContract;
  };
  return project.contentSource ?? { ssot: 'local' };
}

export function isSupabaseSsot(): boolean {
  return readContentSource().ssot === 'supabase';
}

/** Materialize remote rows when contract is supabase and Connect env exists. */
export function shouldMaterializeSupabaseContent(): boolean {
  return isSupabaseSsot() && hasSupabaseConnectEnv();
}
