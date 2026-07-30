#!/usr/bin/env node
/**
 * When `.omd` selects ssot supabase and Connect URL/key env exist, pull
 * remote handbook rows into `.supabase-content/docs` for Fumadocs.
 * Prints `OMD_CONTENT_DIR=...` on stdout for the build wrapper.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsRoot = join(__dirname, '..');
const repoRoot = existsSync(join(docsRoot, '../.omd/project.json'))
  ? join(docsRoot, '..')
  : join(docsRoot, '../..');
const cacheDir = '.supabase-content/docs';

function readSsot() {
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
    return project.contentSource?.ssot ?? 'local';
  }
  return 'local';
}

function hasConnectEnv() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return Boolean(url && key);
}

function main() {
  const ssot = readSsot();
  if (ssot !== 'supabase') {
    console.error(`[prepare-content] contentSource.ssot=${ssot}; using local content/docs.`);
    process.stdout.write('OMD_CONTENT_DIR=\n');
    return;
  }
  if (!hasConnectEnv()) {
    console.error(
      '[prepare-content] ssot=supabase but Connect env missing; using local content/docs cache.',
    );
    process.stdout.write('OMD_CONTENT_DIR=\n');
    return;
  }

  const pull = spawnSync(process.execPath, [join(__dirname, 'pull-supabase-content.mjs')], {
    cwd: docsRoot,
    stdio: 'inherit',
    env: process.env,
  });
  if (pull.status !== 0) {
    process.exit(pull.status ?? 1);
  }
  process.stdout.write(`OMD_CONTENT_DIR=${cacheDir}\n`);
}

main();
