export const DOC_KINDS = ['PRD', 'US', 'PLAN', 'SPEC', 'ADR'] as const;

export type DocKindName = (typeof DOC_KINDS)[number];

/** Infer a document kind from the conventional Oh My Docs catalog path. */
export function docKindFromSlug(slug: readonly string[] | undefined): DocKindName | null {
  if (!slug?.length) return null;

  const [section, catalog] = slug;
  if (section === 'planning' && catalog === 'prds' && slug.length > 2) return 'PRD';
  if (section === 'planning' && catalog === 'stories' && slug.length > 2) return 'US';
  if (section === 'plans' && slug.length > 1) return 'PLAN';
  if (section === 'adr' && slug.length > 1) return 'ADR';
  if (
    section === 'spec' &&
    (catalog === 'data-model' || catalog === 'system-model')
  ) {
    return slug.length > 2 ? 'SPEC' : null;
  }
  if (section === 'spec' && slug.length >= 2) return 'SPEC';
  return null;
}
