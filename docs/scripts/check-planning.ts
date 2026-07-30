import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { validatePlanning } from './planning-validation.ts';

const docsRoot = resolve(import.meta.dirname, '..');
const fromEnv = process.env.OMD_CONTENT_DIR
  ? resolve(docsRoot, process.env.OMD_CONTENT_DIR)
  : null;
const contentDirectory =
  fromEnv && existsSync(fromEnv) ? fromEnv : resolve(docsRoot, 'content/docs');

if (!existsSync(contentDirectory)) {
  console.log(
    'No content directory to validate (Supabase SSOT — pull content before checking).',
  );
  process.exit(0);
}

const problems = validatePlanning(contentDirectory);

if (problems.length > 0) {
  console.error(`Planning validation found ${problems.length} problem(s):\n`);
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log('Planning IDs, references, lifecycle states, and navigation are valid.');
