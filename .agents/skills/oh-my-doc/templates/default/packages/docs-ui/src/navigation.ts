import type * as PageTree from 'fumadocs-core/page-tree';

export interface CatalogDefinition {
  prefix: readonly string[];
  indexUrl: string;
  label: string;
}

export interface CatalogPage {
  slugs: string[];
  url: string;
  data: {
    title: string;
    description?: unknown;
  };
}

export interface CatalogSource {
  getPages(): CatalogPage[];
}

export interface CatalogFooterItem {
  name: string;
  description?: string;
  url: string;
}

export interface CatalogFooterItems {
  previous?: CatalogFooterItem;
  next?: CatalogFooterItem;
}

function normalizeUrl(url: string) {
  return url.length > 1 && url.endsWith('/') ? url.slice(0, -1) : url;
}

/** Hide registered catalog detail pages from the tree while retaining their index. */
export function indexOnlyPageTree(indexUrls: Iterable<string>) {
  const normalizedUrls = new Set(Array.from(indexUrls, normalizeUrl));
  return {
    transformers: [
      {
        folder(node: PageTree.Folder): PageTree.Folder {
          const indexUrl = node.index?.url ? normalizeUrl(node.index.url) : undefined;
          return indexUrl && normalizedUrls.has(indexUrl)
            ? { ...node, children: [], defaultOpen: false }
            : node;
        },
      },
    ],
  };
}

function findCatalog(catalogs: readonly CatalogDefinition[], slug: readonly string[] | undefined) {
  if (!slug) return undefined;
  return catalogs.find(
    ({ prefix }) =>
      slug.length === prefix.length + 1 &&
      prefix.every((segment, index) => slug[index] === segment),
  );
}

/** Build back-to-index and sibling navigation for index-only catalogs. */
export function createCatalogNavigation(
  source: CatalogSource,
  catalogs: readonly CatalogDefinition[],
) {
  return {
    indexLink(slug: readonly string[] | undefined) {
      const catalog = findCatalog(catalogs, slug);
      return catalog ? { href: catalog.indexUrl, label: catalog.label } : undefined;
    },
    footerItems(slug: readonly string[] | undefined): CatalogFooterItems | undefined {
      const catalog = findCatalog(catalogs, slug);
      if (!catalog || !slug) return undefined;

      const depth = catalog.prefix.length;
      const siblings = source
        .getPages()
        .filter(
          (page) =>
            page.slugs.length === depth + 1 &&
            catalog.prefix.every((segment, index) => page.slugs[index] === segment),
        )
        .sort((left, right) =>
          (left.slugs[depth] ?? '').localeCompare(right.slugs[depth] ?? '', undefined, {
            numeric: true,
          }),
        );
      const currentIndex = siblings.findIndex((page) => page.slugs[depth] === slug[depth]);
      if (currentIndex < 0) return undefined;

      const toItem = (page: CatalogPage): CatalogFooterItem => {
        const description =
          typeof page.data.description === 'string' ? page.data.description : undefined;
        return {
          name: page.data.title,
          url: page.url,
          ...(description ? { description } : {}),
        };
      };
      const previous = siblings[currentIndex - 1];
      const next = siblings[currentIndex + 1];
      if (!previous && !next) return undefined;
      return {
        ...(previous ? { previous: toItem(previous) } : {}),
        ...(next ? { next: toItem(next) } : {}),
      };
    },
  };
}
