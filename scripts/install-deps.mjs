#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  installManifestDeps,
  readLock,
  updateLockFromResults,
  writeLock,
} from '../shared/runtime/install.mjs';
import { listSkillDirs, loadSkillManifest } from '../shared/runtime/load-manifest.mjs';
import { validateManifest } from '../shared/runtime/validate.mjs';
import { lockPath, repoRoot, skillDir } from './lib/paths.mjs';

function parseArgs(argv) {
  const out = { skill: null, all: false, dryRun: false, json: false, writeLock: true };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--all') out.all = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--json') out.json = true;
    else if (a === '--no-lock') out.writeLock = false;
    else if (a === '--skill') out.skill = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function usage() {
  return `Usage:
  node scripts/install-deps.mjs --skill <name> [--dry-run] [--json]
  node scripts/install-deps.mjs --all [--dry-run] [--json]

Reads skills/<name>/skill.yaml and installs dependencies via:
  - skills: npx skills add …
  - packages: pnpm/npm/yarn add …
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (!args.all && !args.skill)) {
    console.log(usage());
    process.exit(args.help ? 0 : 1);
  }

  const root = repoRoot();
  const targets = args.all
    ? listSkillDirs(root)
    : [skillDir(args.skill)];

  if (!args.all && !existsSync(join(targets[0], 'skill.yaml'))) {
    throw new Error(`Unknown skill: ${args.skill} (${targets[0]})`);
  }

  const allResults = [];
  let ok = true;

  for (const dir of targets) {
    const { manifest } = await loadSkillManifest(dir);
    const validation = await validateManifest(manifest);
    if (!validation.ok) {
      ok = false;
      allResults.push({
        skill: manifest.name,
        ok: false,
        errors: validation.errors,
      });
      continue;
    }

    const installed = await installManifestDeps(manifest, {
      cwd: root,
      skillDir: dir,
      dryRun: args.dryRun,
      continueOnError: true,
    });
    allResults.push({ skill: manifest.name, ...installed });
    if (!installed.ok) ok = false;

    if (args.writeLock && !args.dryRun) {
      const path = lockPath(root);
      const lock = updateLockFromResults(readLock(path), installed.results);
      writeLock(path, lock);
    }
  }

  const report = { ok, results: allResults };
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const r of allResults) {
      console.log(`\n## ${r.skill} ${r.ok ? 'ok' : 'FAILED'}`);
      if (r.errors) {
        for (const e of r.errors) console.log(`  - schema: ${e}`);
      }
      for (const step of r.results || []) {
        const label = step.kind === 'skill' ? step.resolved?.name : step.resolved?.name;
        const status = step.skipped ? `skip (${step.reason || 'skipped'})` : step.ok ? 'installed' : 'error';
        console.log(`  - ${step.kind}:${label} → ${status}`);
        if (!step.ok && step.command) console.log(`      ${step.command}`);
      }
    }
  }

  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
