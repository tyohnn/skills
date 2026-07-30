#!/usr/bin/env node
/**
 * Build: if ssot=supabase and Connect env present, pull content then
 * regenerate fumadocs-mdx and run next build.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsRoot = join(__dirname, '..');

function run(command, args, env) {
  const result = spawnSync(command, args, {
    cwd: docsRoot,
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function prepareContentDir() {
  const prepared = spawnSync(process.execPath, [join(__dirname, 'prepare-content.mjs')], {
    cwd: docsRoot,
    encoding: 'utf8',
    env: process.env,
  });
  if (prepared.status !== 0) {
    if (prepared.stderr) process.stderr.write(prepared.stderr);
    process.exit(prepared.status ?? 1);
  }
  if (prepared.stderr) process.stderr.write(prepared.stderr);
  const line = String(prepared.stdout ?? '')
    .split('\n')
    .map((s) => s.trim())
    .find((s) => s.startsWith('OMD_CONTENT_DIR='));
  const value = line ? line.slice('OMD_CONTENT_DIR='.length) : '';
  return value || undefined;
}

const contentDir = prepareContentDir();
const env = { ...process.env };
if (contentDir) {
  env.OMD_CONTENT_DIR = contentDir;
  console.error(`[build-with-content] Using OMD_CONTENT_DIR=${contentDir}`);
} else {
  console.error('[build-with-content] Using default content/docs');
}

run('pnpm', ['exec', 'fumadocs-mdx'], env);
run('pnpm', ['exec', 'next', 'build'], env);
run('pnpm', ['run', 'check:planning'], env);
