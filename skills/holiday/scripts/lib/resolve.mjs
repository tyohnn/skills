import { WORKSPACE_CATALOG } from './constants.mjs';

/**
 * Translate a skill dependency into an install command + identity.
 * workspace and github:tyohnn/skills both resolve to the same catalog CLI.
 */
export function resolveSkillDependency(dep) {
  const name = dep.name;
  const source = String(dep.source || '');

  if (source === 'workspace') {
    return {
      name,
      source: `github:${WORKSPACE_CATALOG}`,
      declaredSource: 'workspace',
      resolvedCommand: `npx skills add ${WORKSPACE_CATALOG} --skill ${name} -y`,
      catalog: WORKSPACE_CATALOG,
    };
  }

  const github = source.match(/^github:([^/]+\/[^/]+)$/);
  if (github) {
    const catalog = github[1];
    return {
      name,
      source: `github:${catalog}`,
      declaredSource: source,
      resolvedCommand: `npx skills add ${catalog} --skill ${name} -y`,
      catalog,
    };
  }

  throw new Error(`Unsupported skill dependency source for ${name}: ${source}`);
}

/**
 * Translate a package dependency into a package-manager install specifier.
 */
export function resolvePackageDependency(dep) {
  const name = dep.name;
  const source = String(dep.source || '');
  const manager = dep.manager || null;

  let spec;
  if (source.startsWith('github:')) {
    // pnpm/npm github shorthand: github:owner/repo
    spec = source;
  } else if (source.startsWith('npm:')) {
    spec = source.slice('npm:'.length);
  } else if (source.includes('/') && !source.startsWith('@')) {
    // treat bare owner/repo as github
    spec = `github:${source}`;
  } else {
    // npm package name or full specifier (e.g. lodash@4)
    spec = source === name ? name : source;
  }

  return {
    name,
    source,
    spec,
    manager,
  };
}

export function collectSkillGraph(rootManifest, loadManifestByName) {
  const ordered = [];
  const byName = new Map();
  const visiting = new Set();

  async function walk(manifest) {
    const name = manifest.name;
    if (byName.has(name)) return;
    if (visiting.has(name)) {
      throw new Error(`Dependency cycle detected at skill "${name}"`);
    }
    visiting.add(name);

    const skillDeps = manifest.dependencies?.skills ?? [];
    for (const dep of skillDeps) {
      const resolved = resolveSkillDependency(dep);
      const child = await loadManifestByName(resolved.name, resolved);
      if (child) {
        await walk(child);
      } else {
        // External / not present yet — still record the edge for install.
        if (!byName.has(resolved.name)) {
          byName.set(resolved.name, { manifest: null, resolved });
          ordered.push(resolved.name);
        }
      }
    }

    visiting.delete(name);
    byName.set(name, { manifest, resolved: null });
    ordered.push(name);
  }

  return walk(rootManifest).then(() => ({ ordered, byName }));
}
