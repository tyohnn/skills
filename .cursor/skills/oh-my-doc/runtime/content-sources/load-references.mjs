import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Load Notion declarative templates from skills/oh-my-doc/references/.
 * @param {string} skillRoot
 */
export function loadNotionReferences(skillRoot) {
  const dir = join(skillRoot, 'references');
  return {
    dir,
    iaGraph: JSON.parse(readFileSync(join(dir, 'notion-ia-graph.json'), 'utf8')),
    catalogSchemas: JSON.parse(readFileSync(join(dir, 'notion-catalog-schemas.json'), 'utf8')),
    informationArchitecture: readFileSync(join(dir, 'notion-information-architecture.md'), 'utf8'),
    sidebar: readFileSync(join(dir, 'notion-sidebar.md'), 'utf8'),
    pageTemplates: readFileSync(join(dir, 'notion-page-templates.md'), 'utf8'),
    manualChecklist: readFileSync(join(dir, 'notion-manual-checklist.md'), 'utf8'),
  };
}
