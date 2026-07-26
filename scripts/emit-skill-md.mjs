#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { emitSkillMarkdown } from '../shared/runtime/emit-skill-md.mjs';
import { listSkillDirs, loadSkillManifest } from '../shared/runtime/load-manifest.mjs';
import { validateManifest } from '../shared/runtime/validate.mjs';
import { repoRoot, skillDir } from './lib/paths.mjs';

function parseArgs(argv) {
  const out = { skill: null, all: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--all') out.all = true;
    else if (a === '--json') out.json = true;
    else if (a === '--skill') out.skill = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (!args.all && !args.skill)) {
    console.log(`Usage:
  node scripts/emit-skill-md.mjs --skill <name>
  node scripts/emit-skill-md.mjs --all`);
    process.exit(args.help ? 0 : 1);
  }

  const root = repoRoot();
  const targets = args.all ? listSkillDirs(root) : [skillDir(args.skill)];
  const written = [];

  for (const dir of targets) {
    if (!existsSync(join(dir, 'skill.yaml'))) {
      throw new Error(`Missing skill.yaml: ${dir}`);
    }
    const { manifest } = await loadSkillManifest(dir);
    const validation = await validateManifest(manifest);
    if (!validation.ok) {
      throw new Error(`Invalid skill.yaml for ${manifest.name}: ${validation.errors.join('; ')}`);
    }
    if (manifest.name !== dir.split('/').pop() && manifest.name !== dir.split('\\').pop()) {
      throw new Error(`skill.yaml name "${manifest.name}" must match folder "${dir}"`);
    }
    const path = emitSkillMarkdown(dir, manifest);
    written.push(path);
  }

  if (args.json) console.log(JSON.stringify({ ok: true, written }, null, 2));
  else written.forEach((p) => console.log(`emitted ${p}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
