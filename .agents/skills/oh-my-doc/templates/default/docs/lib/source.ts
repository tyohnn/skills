import { docs } from 'collections/server';
import { loader } from 'fumadocs-core/source';
import { createCatalogNavigation, indexOnlyPageTree } from '@oh-my-docs/ui/navigation';

const CATALOGS = [
  { prefix: ['domain', 'glossary'], indexUrl: '/docs/domain/glossary', label: 'Glossary' },
  { prefix: ['domain', 'models'], indexUrl: '/docs/domain/models', label: 'Models' },
  { prefix: ['domain', 'policies'], indexUrl: '/docs/domain/policies', label: 'Policies' },
  { prefix: ['planning', 'prds'], indexUrl: '/docs/planning/prds', label: 'PRD' },
  { prefix: ['planning', 'stories'], indexUrl: '/docs/planning/stories', label: 'User stories' },
  { prefix: ['plans'], indexUrl: '/docs/plans', label: 'Implementation plans' },
  { prefix: ['adr'], indexUrl: '/docs/adr', label: 'ADR' },
  { prefix: ['spec', 'data-model'], indexUrl: '/docs/spec/data-model', label: 'Data model' },
  {
    prefix: ['spec', 'system-model'],
    indexUrl: '/docs/spec/system-model',
    label: 'System model',
  },
] as const;

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
  pageTree: indexOnlyPageTree(CATALOGS.map((catalog) => catalog.indexUrl)),
});

const catalogNavigation = createCatalogNavigation(source, CATALOGS);

export const catalogIndexLink = catalogNavigation.indexLink;
export const catalogFooterItems = catalogNavigation.footerItems;
