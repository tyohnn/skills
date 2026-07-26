#!/usr/bin/env node
/**
 * Copy shared/runtime modules into each skill so ensure-deps works after
 * `npx skills add` (skills.sh copies only the skill folder).
 */
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { listSkillDirs } from '../shared/runtime/load-manifest.mjs';
import { repoRoot, skillDir } from './lib/paths.mjs';

const RUNTIME_FILES = [
  'constants.mjs',
  'load-manifest.mjs',
  'resolve.mjs',
  'install.mjs',
];

const ENSURE_DEPS_SOURCE = `#!/usr/bin/env node
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
  console.log(\`ensure-deps: \${manifest.name} \${installed.ok ? 'ok' : 'FAILED'}\`);
  for (const step of installed.results) {
    const name = step.resolved?.name ?? '?';
    const status = step.skipped ? \`skip (\${step.reason || 'skipped'})\` : step.ok ? 'ok' : 'error';
    console.log(\`  - \${step.kind}:\${name} → \${status}\`);
  }
}

process.exit(installed.ok ? 0 : 1);
`;

function parseArgs(argv) {
  const out = { skill: null, all: true };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--skill') {
      out.skill = argv[++i];
      out.all = false;
    }
  }
  return out;
}

function syncOne(dir) {
  const root = repoRoot();
  const libDir = join(dir, 'scripts', 'lib');
  mkdirSync(libDir, { recursive: true });
  for (const file of RUNTIME_FILES) {
    const from = join(root, 'shared', 'runtime', file);
    if (!existsSync(from)) throw new Error(`Missing runtime file: ${from}`);
    cpSync(from, join(libDir, file));
  }
  writeFileSync(join(dir, 'scripts', 'ensure-deps.mjs'), ENSURE_DEPS_SOURCE);
  return basename(dir);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = repoRoot();
  const targets = args.all ? listSkillDirs(root) : [skillDir(args.skill)];
  const synced = targets.filter((d) => existsSync(join(d, 'skill.yaml'))).map(syncOne);
  console.log(`synced runtime into: ${synced.join(', ') || '(none)'}`);
}

main();
