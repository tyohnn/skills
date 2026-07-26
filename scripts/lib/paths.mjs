import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findRepoRoot } from '../../shared/runtime/load-manifest.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export function repoRoot() {
  return findRepoRoot(join(HERE, '../..')) || join(HERE, '../..');
}

export function skillDir(name) {
  return join(repoRoot(), 'skills', name);
}

export function lockPath(cwd = repoRoot()) {
  return join(cwd, 'skills-lock.json');
}
