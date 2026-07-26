import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Load skill.yaml. Prefers the `yaml` package when available (monorepo),
 * otherwise falls back to a constrained subset parser for bundled copies.
 */
export async function loadSkillManifest(skillDir) {
  const path = join(skillDir, 'skill.yaml');
  if (!existsSync(path)) {
    throw new Error(`Missing skill.yaml in ${skillDir}`);
  }
  const text = readFileSync(path, 'utf8');
  const data = await parseYaml(text);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`Invalid skill.yaml root in ${path}`);
  }
  if (data.name == null || data.version == null || data.description == null) {
    throw new Error(`skill.yaml missing required fields (name, version, description): ${path}`);
  }
  return { path, manifest: data };
}

async function parseYaml(text) {
  try {
    const mod = await import('yaml');
    return mod.parse(text);
  } catch {
    return parseYamlLite(text);
  }
}

/** Enough for our skill.yaml shape: maps, sequences, scalars, `>` blocks. */
export function parseYamlLite(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let i = 0;

  function peek() {
    while (i < lines.length) {
      const raw = lines[i];
      if (raw.trim() === '' || raw.trim().startsWith('#')) {
        i += 1;
        continue;
      }
      return raw;
    }
    return null;
  }

  function indentOf(line) {
    return line.match(/^ */)[0].length;
  }

  function parseBlock(minIndent) {
    const map = {};
    const seq = [];
    let mode = null;

    while (true) {
      const line = peek();
      if (line == null) break;
      const indent = indentOf(line);
      if (indent < minIndent) break;
      const trimmed = line.trim();

      if (trimmed.startsWith('- ')) {
        if (mode === 'map') {
          throw new Error(`YAML lite: sequence item inside map at line ${i + 1}`);
        }
        mode = 'seq';
        i += 1;
        const rest = trimmed.slice(2);
        if (rest.includes(':') && !rest.startsWith('"') && !rest.startsWith("'")) {
          const obj = {};
          const { key, value, folded } = splitKv(rest);
          obj[key] = folded ? readFolded(indent + 2) : value;
          Object.assign(obj, parseMapContinuation(indent + 2));
          seq.push(obj);
        } else {
          seq.push(parseScalar(rest));
        }
        continue;
      }

      if (trimmed.includes(':')) {
        if (mode === 'seq') {
          throw new Error(`YAML lite: map key inside sequence at line ${i + 1}`);
        }
        mode = 'map';
        i += 1;
        const { key, value, folded, empty } = splitKv(trimmed);
        if (folded) {
          map[key] = readFolded(indent + 2);
        } else if (empty) {
          const next = peek();
          if (next != null && indentOf(next) > indent) {
            map[key] = parseBlock(indent + 1);
          } else {
            map[key] = null;
          }
        } else {
          map[key] = value;
        }
        continue;
      }

      throw new Error(`YAML lite: cannot parse line ${i + 1}: ${trimmed}`);
    }

    if (mode === 'seq') return seq;
    return map;
  }

  function parseMapContinuation(minIndent) {
    const map = {};
    while (true) {
      const line = peek();
      if (line == null) break;
      const indent = indentOf(line);
      if (indent < minIndent) break;
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || !trimmed.includes(':')) break;
      i += 1;
      const { key, value, folded, empty } = splitKv(trimmed);
      if (folded) map[key] = readFolded(indent + 2);
      else if (empty) {
        const next = peek();
        if (next != null && indentOf(next) > indent) map[key] = parseBlock(indent + 1);
        else map[key] = null;
      } else map[key] = value;
    }
    return map;
  }

  function readFolded(minIndent) {
    const parts = [];
    while (true) {
      const line = peek();
      if (line == null) break;
      const indent = indentOf(line);
      if (indent < minIndent) break;
      i += 1;
      parts.push(line.slice(minIndent).trimEnd());
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  function splitKv(trimmed) {
    const idx = trimmed.indexOf(':');
    const key = trimmed.slice(0, idx).trim();
    const raw = trimmed.slice(idx + 1).trim();
    if (raw === '>' || raw === '|') return { key, folded: true, empty: false, value: null };
    if (raw === '') return { key, empty: true, folded: false, value: null };
    return { key, value: parseScalar(raw), empty: false, folded: false };
  }

  function parseScalar(raw) {
    if (
      (raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'"))
    ) {
      return raw.slice(1, -1);
    }
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (raw === 'null') return null;
    if (raw === '[]') return [];
    if (raw === '{}') return {};
    if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
    const hash = raw.indexOf(' #');
    return (hash === -1 ? raw : raw.slice(0, hash)).trim();
  }

  return parseBlock(0);
}

export function findRepoRoot(fromDir = process.cwd()) {
  let dir = fromDir;
  for (;;) {
    if (existsSync(join(dir, 'skills')) && existsSync(join(dir, 'package.json'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function listSkillDirs(repoRoot) {
  const skillsRoot = join(repoRoot, 'skills');
  if (!existsSync(skillsRoot)) return [];
  return readdirSync(skillsRoot)
    .map((name) => join(skillsRoot, name))
    .filter((p) => {
      try {
        return statSync(p).isDirectory() && existsSync(join(p, 'skill.yaml'));
      } catch {
        return false;
      }
    })
    .sort();
}
