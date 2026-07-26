/**
 * Minimal frontmatter parser (stdlib-only).
 * Supports scalars, inline arrays `[a, b]`, and block arrays `- item`.
 */

function parseScalar(raw) {
  const value = raw.trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null' || value === '~') return null;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((part) => parseScalar(part));
  }
  return value;
}

/**
 * @param {string} yamlBody
 * @returns {Record<string, unknown>}
 */
export function parseYamlLike(yamlBody) {
  /** @type {Record<string, unknown>} */
  const result = {};
  const lines = yamlBody.replace(/\r\n/g, '\n').split('\n');
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim() || line.trimStart().startsWith('#')) {
      index += 1;
      continue;
    }
    const match = /^(?<key>[A-Za-z0-9_-]+)\s*:\s*(?<rest>.*)$/.exec(line);
    if (!match?.groups) {
      throw new Error(`unsupported frontmatter line: ${line}`);
    }
    const key = match.groups.key;
    const rest = match.groups.rest.trim();
    if (rest.length > 0) {
      result[key] = parseScalar(rest);
      index += 1;
      continue;
    }
    /** @type {string[]} */
    const items = [];
    let cursor = index + 1;
    while (cursor < lines.length) {
      const next = lines[cursor];
      if (!next.trim()) {
        cursor += 1;
        continue;
      }
      const item = /^\s+-\s+(.*)$/.exec(next);
      if (!item) break;
      items.push(String(parseScalar(item[1] ?? '')));
      cursor += 1;
    }
    result[key] = items;
    index = cursor;
  }
  return result;
}

/**
 * @param {string} source
 * @param {string} file
 * @returns {Record<string, unknown>}
 */
export function parseFrontmatter(source, file) {
  if (!source.startsWith('---\n')) {
    throw new Error(`${file}: frontmatter must start on the first line`);
  }
  const end = source.indexOf('\n---', 4);
  if (end === -1) throw new Error(`${file}: frontmatter is not closed`);
  const parsed = parseYamlLike(source.slice(4, end));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${file}: frontmatter must be a mapping`);
  }
  return parsed;
}
