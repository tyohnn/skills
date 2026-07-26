#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { emitSkillMarkdown } from '../shared/runtime/emit-skill-md.mjs';
import { loadSkillManifest } from '../shared/runtime/load-manifest.mjs';
import { repoRoot, skillDir } from './lib/paths.mjs';
import { spawnSync } from 'node:child_process';

function parseArgs(argv) {
  const out = {
    name: null,
    kind: 'utility',
    description: null,
    domains: [],
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--name') out.name = argv[++i];
    else if (a === '--kind') out.kind = argv[++i];
    else if (a === '--description') out.description = argv[++i];
    else if (a === '--domain') out.domains.push(argv[++i]);
    else if (!a.startsWith('-') && !out.name) out.name = a;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function renderSkillYaml({ name, kind, description, domains }) {
  const lines = [
    `name: ${name}`,
    'version: 0.1.0',
    `kind: ${kind}`,
  ];
  if (domains.length) {
    lines.push('domains:');
    for (const d of domains) lines.push(`  - ${d}`);
  }
  lines.push('description: >');
  lines.push(`  ${description}`);
  lines.push('');
  lines.push('dependencies:');
  lines.push('  skills: []');
  lines.push('  packages: []');
  lines.push('');
  lines.push('entrypoints:');
  lines.push('  instructions: SKILL.md');
  lines.push('  ensureDeps: scripts/ensure-deps.mjs');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.name) {
    console.log(`Usage:
  node scripts/create-skill.mjs --name <slug> [--kind utility|domain|workflow|framework|scaffolding]
    [--description "..."] [--domain <tag>]`);
    process.exit(args.help ? 0 : 1);
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args.name)) {
    throw new Error('name must be kebab-case');
  }

  const dir = skillDir(args.name);
  if (existsSync(dir)) throw new Error(`Skill already exists: ${dir}`);

  const description =
    args.description ||
    `${args.name} skill — describe purpose, trigger conditions, and outcomes.`;

  mkdirSync(join(dir, 'scripts'), { recursive: true });
  writeFileSync(
    join(dir, 'skill.yaml'),
    renderSkillYaml({
      name: args.name,
      kind: args.kind,
      description,
      domains: args.domains,
    }),
  );

  const sync = spawnSync(process.execPath, [join(repoRoot(), 'scripts/sync-skill-runtime.mjs'), '--skill', args.name], {
    cwd: repoRoot(),
    stdio: 'inherit',
  });
  if (sync.status !== 0) throw new Error('sync-skill-runtime failed');

  const { manifest } = await loadSkillManifest(dir);
  emitSkillMarkdown(dir, manifest);
  console.log(`created skills/${args.name}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
