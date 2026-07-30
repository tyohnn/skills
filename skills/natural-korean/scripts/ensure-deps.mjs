#!/usr/bin/env node
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  installManifestDeps,
  readLock,
  updateLockFromResults,
  writeLock,
} from './lib/install.mjs';
import { loadSkillManifest } from './lib/load-manifest.mjs';

const skillDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const cwd = process.cwd();

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const json = args.has('--json');

const { manifest } = await loadSkillManifest(skillDir);
const installed = await installManifestDeps(manifest, {
  cwd,
  skillDir,
  dryRun,
  continueOnError: true,
});

if (!dryRun) {
  const lockFile = join(skillDir, 'skills-lock.json');
  const lock = updateLockFromResults(readLock(lockFile), installed.results);
  writeLock(lockFile, lock);
}

if (json) {
  console.log(JSON.stringify({ skill: manifest.name, ...installed }, null, 2));
} else {
  console.log(`ensure-deps: ${manifest.name} ${installed.ok ? 'ok' : 'FAILED'}`);
  for (const step of installed.results) {
    const name = step.resolved?.name ?? '?';
    const status = step.skipped ? `skip (${step.reason || 'skipped'})` : step.ok ? 'ok' : 'error';
    console.log(`  - ${step.kind}:${name} → ${status}`);
  }
}

process.exit(installed.ok ? 0 : 1);
