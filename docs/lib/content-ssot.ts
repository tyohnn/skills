import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type ContentSsot = 'local' | 'notion' | 'supabase';

export type ContentSourceContract = {
  ssot: ContentSsot;
  supabase?: { projectRef: string; schemaVersion: string };
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

/**
 * Read handbook SSOT from repo-root `.omd/project.json`.
 * Missing contract ⇒ local (dogfood / legacy).
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
