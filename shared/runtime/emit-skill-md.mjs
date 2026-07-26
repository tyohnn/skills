import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BODY_MARKERS, INSTALL_MARKERS, WORKSPACE_CATALOG } from './constants.mjs';
import { resolvePackageDependency, resolveSkillDependency } from './resolve.mjs';

function escapeYamlDouble(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function normalizeDescription(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildFrontmatter(manifest) {
  const depends = (manifest.dependencies?.skills ?? [])
    .filter((d) => d.source === 'workspace' || d.source === `github:${WORKSPACE_CATALOG}`)
    .map((d) => d.name);

  const description = normalizeDescription(manifest.description);
  const lines = ['---', `name: ${manifest.name}`, `description: "${escapeYamlDouble(description)}"`];
  if (depends.length > 0) {
    lines.push('depends:');
    for (const name of depends) lines.push(`  - ${name}`);
  }
  lines.push('---', '');
  return lines.join('\n');
}

function buildInstallBlock(manifest) {
  const skillDeps = manifest.dependencies?.skills ?? [];
  const packageDeps = manifest.dependencies?.packages ?? [];
  const lines = [
    '## Install',
    '',
    INSTALL_MARKERS.start,
    '',
    '```bash',
    '# generated — do not hand-edit; run: node scripts/emit-skill-md.mjs --skill ' + manifest.name,
  ];

  for (const dep of skillDeps) {
    const resolved = resolveSkillDependency(dep);
    lines.push(resolved.resolvedCommand);
  }

  if (packageDeps.length > 0) {
    lines.push('# packages (also installed by ensure-deps)');
    for (const dep of packageDeps) {
      const resolved = resolvePackageDependency(dep);
      lines.push(`# ${resolved.spec}`);
    }
  }

  lines.push('node scripts/ensure-deps.mjs');
  lines.push('```');
  lines.push('');
  lines.push(INSTALL_MARKERS.end);
  lines.push('');
  return lines.join('\n');
}

function extractBody(existing) {
  if (!existing) {
    return [
      BODY_MARKERS.start,
      '',
      '## When to use',
      '',
      '- Describe when this skill should run.',
      '',
      '## Procedure',
      '',
      '1. Ensure dependencies: `node scripts/ensure-deps.mjs`',
      '2. Do the work.',
      '',
      BODY_MARKERS.end,
      '',
    ].join('\n');
  }

  const start = existing.indexOf(BODY_MARKERS.start);
  const end = existing.indexOf(BODY_MARKERS.end);
  if (start !== -1 && end !== -1 && end > start) {
    return existing.slice(start, end + BODY_MARKERS.end.length) + '\n';
  }

  // Preserve legacy body after frontmatter / Install by wrapping unmarked content.
  let body = existing;
  if (body.startsWith('---')) {
    const close = body.indexOf('\n---', 3);
    if (close !== -1) body = body.slice(close + 4).replace(/^\n/, '');
  }
  const installStart = body.indexOf(INSTALL_MARKERS.start);
  if (installStart !== -1) {
    const installEnd = body.indexOf(INSTALL_MARKERS.end);
    if (installEnd !== -1) {
      body = (body.slice(0, installStart) + body.slice(installEnd + INSTALL_MARKERS.end.length)).trim();
    }
  }
  // Drop a leading ## Install section if present without markers
  body = body.replace(/^## Install[\s\S]*?(?=^## |\z)/m, '').trim();

  return `${BODY_MARKERS.start}\n\n${body}\n\n${BODY_MARKERS.end}\n`;
}

export function renderSkillMarkdown(manifest, existing = null) {
  const frontmatter = buildFrontmatter(manifest);
  const install = buildInstallBlock(manifest);
  const body = extractBody(existing);
  return `${frontmatter}${install}${body}`;
}

export function emitSkillMarkdown(skillDir, manifest) {
  const skillMdPath = join(skillDir, 'SKILL.md');
  const existing = existsSync(skillMdPath) ? readFileSync(skillMdPath, 'utf8') : null;
  const next = renderSkillMarkdown(manifest, existing);
  writeFileSync(skillMdPath, next.endsWith('\n') ? next : `${next}\n`);
  return skillMdPath;
}
