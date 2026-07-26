#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { skillIsPresent } from '../shared/runtime/install.mjs';
import { listSkillDirs, loadSkillManifest } from '../shared/runtime/load-manifest.mjs';
import { resolveSkillDependency } from '../shared/runtime/resolve.mjs';
import { validateManifest } from '../shared/runtime/validate.mjs';
import { repoRoot } from './lib/paths.mjs';

function parseArgs(argv) {
  const out = { json: false, requireInstalled: false };
  for (const a of argv) {
    if (a === '--json') out.json = true;
    else if (a === '--require-installed') out.requireInstalled = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage: node scripts/verify-all.mjs [--json] [--require-installed]`);
    process.exit(0);
  }

  const root = repoRoot();
  const dirs = listSkillDirs(root);
  const problems = [];
  const skills = [];

  for (const dir of dirs) {
    const folder = basename(dir);
    const { manifest } = await loadSkillManifest(dir);
    const validation = await validateManifest(manifest);
    if (!validation.ok) {
      for (const e of validation.errors) problems.push(`${folder}: ${e}`);
    }
    if (manifest.name !== folder) {
      problems.push(`${folder}: skill.yaml name "${manifest.name}" != folder`);
    }
    if (!existsSync(join(dir, 'SKILL.md'))) {
      problems.push(`${folder}: missing SKILL.md (run emit-skill-md)`);
    }
    if (!existsSync(join(dir, 'scripts', 'ensure-deps.mjs'))) {
      problems.push(`${folder}: missing scripts/ensure-deps.mjs`);
    }

    for (const dep of manifest.dependencies?.skills ?? []) {
      try {
        resolveSkillDependency(dep);
      } catch (err) {
        problems.push(`${folder}: ${err.message}`);
        continue;
      }
      if (dep.source === 'workspace') {
        const sibling = join(root, 'skills', dep.name);
        if (!existsSync(join(sibling, 'skill.yaml'))) {
          problems.push(`${folder}: workspace dep missing skills/${dep.name}`);
        }
      }
      if (args.requireInstalled) {
        const present = skillIsPresent(dep.name, { skillDir: dir, cwd: root });
        if (!present) problems.push(`${folder}: dependency not installed: ${dep.name}`);
      }
    }

    skills.push({ name: manifest.name, kind: manifest.kind || null, dir });
  }

  const report = { ok: problems.length === 0, skills, problems };
  if (args.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`skills: ${skills.length}`);
    for (const s of skills) console.log(`  - ${s.name}${s.kind ? ` (${s.kind})` : ''}`);
    if (problems.length) {
      console.log('\nproblems:');
      for (const p of problems) console.log(`  - ${p}`);
    } else console.log('\nok');
  }
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
