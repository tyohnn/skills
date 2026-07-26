import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(HERE, '../schemas/skill.schema.json');

export async function validateManifest(manifest, { schemaPath = SCHEMA_PATH } = {}) {
  let Ajv2020;
  try {
    ({ default: Ajv2020 } = await import('ajv/dist/2020.js'));
  } catch {
    return validateManifestLite(manifest);
  }

  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const ok = validate(manifest);
  return {
    ok,
    errors: ok
      ? []
      : (validate.errors || []).map((e) => `${e.instancePath || '/'} ${e.message}`),
  };
}

export function validateManifestLite(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') {
    return { ok: false, errors: ['manifest must be an object'] };
  }
  for (const key of ['name', 'version', 'description']) {
    if (!manifest[key] || typeof manifest[key] !== 'string') {
      errors.push(`missing or invalid ${key}`);
    }
  }
  if (manifest.name && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.name)) {
    errors.push('name must be kebab-case');
  }
  if (manifest.kind) {
    const kinds = ['utility', 'domain', 'workflow', 'framework', 'scaffolding'];
    if (!kinds.includes(manifest.kind)) errors.push(`invalid kind: ${manifest.kind}`);
  }
  for (const dep of manifest.dependencies?.skills ?? []) {
    if (!dep.name || !dep.source) errors.push('skill dependency needs name + source');
    else if (!/^(workspace|github:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)$/.test(dep.source)) {
      errors.push(`invalid skill source for ${dep.name}: ${dep.source}`);
    }
  }
  for (const dep of manifest.dependencies?.packages ?? []) {
    if (!dep.name || !dep.source) errors.push('package dependency needs name + source');
  }
  return { ok: errors.length === 0, errors };
}
