import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { LOCK_VERSION, WORKSPACE_CATALOG } from './constants.mjs';
import { findRepoRoot } from './load-manifest.mjs';
import { resolvePackageDependency, resolveSkillDependency } from './resolve.mjs';

export function skillIsPresent(name, { skillDir, cwd = process.cwd() } = {}) {
  const candidates = [];

  if (skillDir) {
    // Sibling under the same host install root: .../skills/<name>
    candidates.push(join(dirname(skillDir), name));
  }

  const repoRoot = findRepoRoot(cwd) || findRepoRoot(skillDir || cwd);
  if (repoRoot) {
    candidates.push(join(repoRoot, 'skills', name));
  }

  // Common skills.sh / agent host install roots
  for (const base of [
    join(cwd, '.agents', 'skills'),
    join(cwd, '.cursor', 'skills'),
    join(cwd, '.claude', 'skills'),
    join(cwd, 'skills'),
  ]) {
    candidates.push(join(base, name));
  }

  // Walk up a few parents for host roots
  let dir = cwd;
  for (let depth = 0; depth < 6; depth += 1) {
    candidates.push(join(dir, '.agents', 'skills', name));
    candidates.push(join(dir, '.cursor', 'skills', name));
    candidates.push(join(dir, '.claude', 'skills', name));
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  for (const c of candidates) {
    if (existsSync(join(c, 'SKILL.md')) || existsSync(join(c, 'skill.yaml'))) {
      return c;
    }
  }
  return null;
}

export function runCommand(command, args, { cwd = process.cwd(), dryRun = false } = {}) {
  const pretty = [command, ...args].join(' ');
  if (dryRun) {
    return { ok: true, skipped: true, reason: 'dry-run', command: pretty };
  }
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('error', (err) => {
      resolve({ ok: false, command: pretty, error: String(err) });
    });
    child.on('exit', (code) => {
      resolve({ ok: code === 0, code, command: pretty });
    });
  });
}

export async function ensureSkillInstalled(dep, options = {}) {
  const resolved = resolveSkillDependency(dep);
  const present = skillIsPresent(resolved.name, options);
  if (present) {
    return {
      ok: true,
      skipped: true,
      reason: 'already-present',
      path: present,
      resolved,
    };
  }

  const npxArgs = ['skills', 'add', resolved.catalog, '--skill', resolved.name, '-y'];
  const result = await runCommand('npx', npxArgs, {
    cwd: options.cwd,
    dryRun: options.dryRun,
  });
  return { ...result, resolved };
}

export function detectPackageManager(cwd = process.cwd()) {
  if (existsSync(join(cwd, 'pnpm-lock.yaml')) || existsSync(join(cwd, 'pnpm-workspace.yaml'))) {
    return 'pnpm';
  }
  if (existsSync(join(cwd, 'yarn.lock'))) return 'yarn';
  if (existsSync(join(cwd, 'package-lock.json'))) return 'npm';
  // Prefer pnpm in this monorepo; fall back to npm elsewhere.
  return existsSync(join(cwd, 'package.json')) ? 'npm' : 'pnpm';
}

export async function ensurePackageInstalled(dep, options = {}) {
  const resolved = resolvePackageDependency(dep);
  const manager = resolved.manager || detectPackageManager(options.cwd || process.cwd());
  const cwd = options.cwd || process.cwd();

  let command;
  let args;
  if (manager === 'pnpm') {
    command = 'pnpm';
    args = ['add', resolved.spec];
  } else if (manager === 'yarn') {
    command = 'yarn';
    args = ['add', resolved.spec];
  } else {
    command = 'npm';
    args = ['install', resolved.spec];
  }

  const result = await runCommand(command, args, { cwd, dryRun: options.dryRun });
  return { ...result, resolved, manager };
}

export async function installManifestDeps(manifest, options = {}) {
  const results = [];
  const skillDeps = manifest.dependencies?.skills ?? [];
  const packageDeps = manifest.dependencies?.packages ?? [];

  for (const dep of skillDeps) {
    const r = await ensureSkillInstalled(dep, options);
    results.push({ kind: 'skill', ...r });
    if (!r.ok && !options.continueOnError) {
      return { ok: false, results };
    }
  }

  for (const dep of packageDeps) {
    const r = await ensurePackageInstalled(dep, options);
    results.push({ kind: 'package', ...r });
    if (!r.ok && !options.continueOnError) {
      return { ok: false, results };
    }
  }

  const ok = results.every((r) => r.ok);
  return { ok, results };
}

export function readLock(lockPath) {
  if (!existsSync(lockPath)) {
    return { lockVersion: LOCK_VERSION, skills: {}, packages: {} };
  }
  return JSON.parse(readFileSync(lockPath, 'utf8'));
}

export function writeLock(lockPath, lock) {
  mkdirSync(dirname(lockPath), { recursive: true });
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
}

export function updateLockFromResults(lock, results, { installedAt = new Date().toISOString() } = {}) {
  const next = {
    lockVersion: LOCK_VERSION,
    skills: { ...(lock.skills || {}) },
    packages: { ...(lock.packages || {}) },
  };

  for (const r of results) {
    if (r.kind === 'skill' && r.resolved) {
      next.skills[r.resolved.name] = {
        source: r.resolved.source,
        skill: r.resolved.name,
        declaredSource: r.resolved.declaredSource,
        resolvedCommand: r.resolved.resolvedCommand,
        installedAt,
        skipped: Boolean(r.skipped),
        path: r.path || null,
      };
    }
    if (r.kind === 'package' && r.resolved) {
      next.packages[r.resolved.name] = {
        source: r.resolved.source,
        spec: r.resolved.spec,
        manager: r.manager,
        installedAt,
        skipped: Boolean(r.skipped),
      };
    }
  }
  return next;
}

export { WORKSPACE_CATALOG };
