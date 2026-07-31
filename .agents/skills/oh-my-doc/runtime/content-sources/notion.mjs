import { createHash } from 'node:crypto';

import { digest, stableStringify } from '../omd-contract.mjs';
import { loadHandbookIaGraph, databaseKeyForKind } from '../ia-graph.mjs';
import { loadNotionReferences } from './load-references.mjs';
import { parseNotionRoot } from './notion-root.mjs';
import {
  defaultPageBody,
  renderSidebarPageContent,
  renderStackedHomeContent,
  resolveActiveSection,
  validateManifestSidebarChrome,
  validateSidebarChrome,
} from './sidebar.mjs';

/**
 * @param {{
 *   skillRoot: string,
 *   notionRoot: string,
 *   mappings?: Record<string, { id: string, type: string, parentKey?: string, url?: string }>,
 *   pendingOperationIds?: string[],
 * }} options
 */
export function planProvision(options) {
  const root = parseNotionRoot(options.notionRoot);
  const refs = loadNotionReferences(options.skillRoot);
  const mappings = options.mappings ?? {};
  const operations = [];
  const objectsByKey = Object.fromEntries(refs.iaGraph.objects.map((o) => [o.key, o]));

  // 1) Create pages and databases in dependency order.
  for (const object of refs.iaGraph.objects) {
    const dependsOn =
      object.parent === 'root' || object.suppliedAsRoot === true
        ? []
        : [`ensure:${object.parent}`];
    if (object.kind === 'page' && object.suppliedAsRoot === true) {
      const payload = {
        key: object.key,
        kind: 'page',
        title: object.title,
        parent: 'root',
        role: object.role ?? 'home',
        suppliedAsRoot: true,
      };
      operations.push({
        id: `ensure:${object.key}`,
        key: object.key,
        op: 'map_supplied_root',
        dependsOn: [],
        expectedParentKey: 'root',
        title: object.title,
        desiredDigest: digest(stableStringify(payload)),
        payload,
        mcp: {
          notes:
            'Map --notion-root to pages.home. Do not create a page; seed mapping from the supplied root.',
        },
      });
      continue;
    }
    if (object.kind === 'page') {
      const payload = {
        key: object.key,
        kind: 'page',
        title: object.title,
        parent: object.parent,
        role: object.role ?? null,
        inlineDatabase: object.inlineDatabase ?? null,
      };
      operations.push({
        id: `ensure:${object.key}`,
        key: object.key,
        op: 'ensure_page',
        dependsOn,
        expectedParentKey: object.parent,
        title: object.title,
        desiredDigest: digest(stableStringify(payload)),
        payload,
        mcp: {
          tool: 'notion-create-pages',
          parentFrom: object.parent === 'root' ? 'root' : object.parent,
          notes: 'Skip create when mapping exists and fetch(kind=page,parent) validates.',
        },
      });
    } else if (object.kind === 'database') {
      const schema = refs.catalogSchemas.schemas[object.schema];
      if (!schema) {
        throw new Error(`missing catalog schema: ${object.schema}`);
      }
      const payload = {
        key: object.key,
        kind: 'database',
        title: object.title,
        parent: object.parent,
        inline: object.inline === true,
        schema: object.schema,
        properties: schema.properties,
      };
      operations.push({
        id: `ensure:${object.key}`,
        key: object.key,
        op: 'ensure_database',
        dependsOn: [`ensure:${object.parent}`],
        expectedParentKey: object.parent,
        title: object.title,
        schema: object.schema,
        inline: object.inline === true,
        desiredDigest: digest(stableStringify(payload)),
        payload,
        mcp: {
          tool: 'notion-create-database',
          parentFrom: object.parent,
          notes:
            'Creates full-page DB; always follow with set_inline when inline=true. Map property types to DDL: title→TITLE, rich_text→RICH_TEXT, select→SELECT(...), multi_select→MULTI_SELECT, relation→RELATION(ds), unique_id→UNIQUE_ID PREFIX \'<prefix>\'. Never write OMD ID on row create — it is auto-generated.',
        },
      });
      if (object.inline === true) {
        operations.push({
          id: `inline:${object.key}`,
          key: object.key,
          op: 'set_inline',
          dependsOn: [`ensure:${object.key}`],
          expectedParentKey: object.parent,
          inline: true,
          desiredDigest: digest(`inline:${object.key}`),
          payload: { key: object.key, inline: true },
          mcp: {
            tool: 'notion-update-data-source',
            notes: 'Set is_inline=true on the data source after create-database.',
          },
        });
      }
    }
  }

  // 2) Optional details toggle on Home (legacy). Slim Notion IA uses catalogs-on-home
  // with flat top-level catalog pages and no sourcesToggle.
  const homeKey =
    refs.iaGraph.objects.find((o) => o.role === 'home')?.key ?? 'pages.home';
  const sourcesChildren = refs.iaGraph.objects.filter(
    (o) => o.parent === homeKey && o.kind === 'page',
  );
  const sourcesStrategy = refs.iaGraph.sourcesStrategy ?? 'catalogs-on-home';
  const sourcesToggle = refs.iaGraph.sourcesToggle;
  /** @type {string | null} */
  let sourcesToggleMarkdown = null;
  if (sourcesToggle?.key) {
    const sourcesKey = sourcesToggle.key;
    const sourcesTitle = sourcesToggle.title ?? '데이터 원본';
    sourcesToggleMarkdown = [
      `<details>`,
      `<summary>${sourcesTitle}</summary>`,
      ...sourcesChildren.map((o) => `\t<page url="{{${o.key}}}">${o.title}</page>`),
      `</details>`,
    ].join('\n');
    operations.push({
      id: 'sources:root-index',
      key: sourcesKey,
      op: 'write_root_sources_index',
      dependsOn: [
        `ensure:${homeKey}`,
        ...sourcesChildren.map((o) => `ensure:${o.key}`),
      ],
      expectedParentKey: homeKey,
      title: sourcesTitle,
      desiredDigest: digest(
        stableStringify({
          sourcesKey,
          strategy: sourcesStrategy,
          homeKey,
          children: sourcesChildren.map((o) => o.key),
        }),
      ),
      payload: {
        strategy: sourcesStrategy,
        sourcesKey,
        homeKey,
        title: sourcesTitle,
        children: sourcesChildren.map((o) => o.key),
        content: sourcesToggleMarkdown,
      },
      mcp: {
        tool: 'notion-update-page',
        notes:
          'On pages.home, write a <details> 데이터 원본 toggle listing managed top-level pages. Never ensure_page a sources container.',
      },
    });
  }

  // 3) Relations after both endpoints exist — walk each DB object, not schema name alone.
  for (const fromDb of refs.iaGraph.objects.filter((o) => o.kind === 'database')) {
    const schema = refs.catalogSchemas.schemas[fromDb.schema];
    if (!schema) continue;
    for (const relation of schema.relations ?? []) {
      const targets = relation.toDatabaseKey
        ? [relation.toDatabaseKey]
        : (relation.toDatabaseKeys ?? []);
      for (const toKey of targets) {
        const payload = {
          from: fromDb.key,
          property: relation.from,
          to: toKey,
        };
        operations.push({
          id: `relation:${fromDb.key}:${relation.from}:${toKey}`,
          key: fromDb.key,
          op: 'ensure_relation',
          dependsOn: [`ensure:${fromDb.key}`, `ensure:${toKey}`],
          expectedParentKey: fromDb.parent,
          desiredDigest: digest(stableStringify(payload)),
          payload,
          mcp: {
            tool: 'notion-update-data-source',
            notes: 'One relation property targets exactly one data source.',
          },
        });
      }
    }
  }

  // 4) Write Home body. stacked-on-home = agent stack (no sidebar / no child pages).
  const placeholderMappings = Object.fromEntries(
    refs.iaGraph.objects
      .filter((o) => o.kind === 'page' || o.kind === 'database')
      .map((o) => [o.key, { url: `{{${o.key}}}` }]),
  );

  if (sourcesStrategy === 'stacked-on-home') {
    const homeObject =
      refs.iaGraph.objects.find((o) => o.role === 'home') ??
      refs.iaGraph.objects.find((o) => o.key === homeKey);
    const homeStack = refs.iaGraph.homeStack;
    if (!homeStack?.sections?.length) {
      throw new Error(
        'stacked-on-home requires notion-ia-graph.json homeStack.sections (도메인/기획/개발)',
      );
    }
    const objectsByKey = Object.fromEntries(
      refs.iaGraph.objects.map((o) => [o.key, o]),
    );
    const sections = homeStack.sections.map((section) => ({
      id: section.id,
      title: section.title,
      databases: (section.databases ?? []).map((key) => {
        const object = objectsByKey[key];
        if (!object || object.kind !== 'database') {
          throw new Error(
            `homeStack section "${section.title}" references missing database ${key}`,
          );
        }
        return {
          key,
          title: object.title,
          url: placeholderMappings[key]?.url ?? `{{${key}}}`,
        };
      }),
    }));
    const databaseKeys = sections.flatMap((s) => s.databases.map((d) => d.key));
    const content = renderStackedHomeContent({
      bodyMarkdown: defaultPageBody(homeKey, homeObject?.title ?? 'Home'),
      sections,
    });
    const payload = {
      key: homeKey,
      template: 'stacked-on-home',
      content,
      preserveChildren: true,
    };
    operations.push({
      id: `body:${homeKey}`,
      key: homeKey,
      op: 'write_page_body',
      dependsOn: [
        `ensure:${homeKey}`,
        ...databaseKeys.map((key) => `ensure:${key}`),
        ...databaseKeys.map((key) => `inline:${key}`),
      ],
      expectedParentKey: 'root',
      desiredDigest: digest(stableStringify({ key: homeKey, content })),
      payload,
      mcp: {
        tool: 'notion-update-page',
        command: 'replace_content',
        notes:
          'Home is the only managed page. Section headers only (도메인/기획/개발) + inline DBs. No per-catalog headings, no sidebar, no child pages. Substitute {{dbs.*}} from mappings before write.',
      },
    });
  } else {
    for (const object of refs.iaGraph.objects.filter((o) => o.kind === 'page')) {
      const childBlocks = [];
      if (object.role === 'home' && sourcesToggleMarkdown) {
        childBlocks.push(sourcesToggleMarkdown);
      } else {
        for (const child of refs.iaGraph.objects.filter((o) => o.parent === object.key)) {
          if (child.kind === 'page') {
            childBlocks.push(`<page url="{{${child.key}}}">${child.title}</page>`);
          } else if (child.kind === 'database') {
            childBlocks.push(
              `<database url="{{${child.key}}}" inline="true">${child.title}</database>`,
            );
          }
        }
      }

      const content = renderSidebarPageContent({
        activeKey: object.key,
        mappings: placeholderMappings,
        nav: refs.iaGraph.nav,
        bodyMarkdown: defaultPageBody(object.key, object.title),
        childBlocks,
      });

      const payload = {
        key: object.key,
        template: 'shared-sidebar',
        activeSection: resolveActiveSection(object.key, refs.iaGraph.nav),
        content,
        preserveChildren: true,
      };
      operations.push({
        id: `body:${object.key}`,
        key: object.key,
        op: 'write_page_body',
        dependsOn: [
          `ensure:${object.key}`,
          ...refs.iaGraph.nav.topLevel.map((k) => `ensure:${k}`),
          ...(object.role === 'home' && sourcesToggleMarkdown ? ['sources:root-index'] : []),
        ],
        expectedParentKey: object.parent,
        desiredDigest: digest(stableStringify({ key: object.key, content })),
        payload,
        mcp: {
          tool: 'notion-update-page',
          command: 'replace_content',
          notes:
            object.role === 'home'
              ? sourcesToggleMarkdown
                ? 'Home is the supplied root. Include <details> 데이터 원본 with top-level children. Preserve child page/database blocks.'
                : 'Home is the supplied root. Flat catalog nav only (ADR-008). Preserve child page/database blocks.'
              : 'Required for every pages.* key. Preserve child <page>/<database> blocks. Substitute {{pages.*}}/{{dbs.*}} from state mappings before write.',
        },
      });
    }
  }

  const pending = new Set(options.pendingOperationIds ?? []);
  const planned = operations.map((op) => {
    const mapped = mappings[op.key];
    const expectedType =
      objectsByKey[op.key]?.kind === 'database'
        ? 'database'
        : 'page';
    const mappingCheck = mapped
      ? validateMapping({
          key: op.key,
          mapping: mapped,
          expectedType,
          expectedParentKey: op.expectedParentKey,
        })
      : null;
    let action = op.op === 'map_supplied_root' ? 'map' : 'create';
    if (mapped && mappingCheck?.ok) {
      action = pending.has(op.id) ? 'retry' : 'skip_or_update';
    } else if (mapped && !mappingCheck?.ok) {
      action = 'mapping_conflict';
    } else if (pending.has(op.id)) {
      action = 'retry';
    }
    return {
      ...op,
      action,
      mappedId: mapped?.id ?? null,
      mappingProblems: mappingCheck?.ok === false ? mappingCheck.problems : [],
    };
  });

  const chromeValidation = validateManifestSidebarChrome({
    operations: planned,
    nav: refs.iaGraph.nav,
    sourcesStrategy,
    homeStack: refs.iaGraph.homeStack,
    catalogTitles: refs.iaGraph.objects
      .filter((o) => o.kind === 'database')
      .map((o) => o.title)
      .filter(Boolean),
  });

  const manifest = {
    schemaVersion: '1.4',
    provider: 'notion',
    root,
    sourcesStrategy,
    homeStack: refs.iaGraph.homeStack ?? null,
    chrome:
      refs.iaGraph.chrome ??
      (sourcesStrategy === 'stacked-on-home'
        ? { requiredOn: 'none' }
        : { requiredOn: 'all-pages' }),
    references: {
      iaGraph: 'references/notion-ia-graph.json',
      catalogSchemas: 'references/notion-catalog-schemas.json',
      sidebar: 'references/notion-sidebar.md',
      pageTemplates: 'references/notion-page-templates.md',
      manualChecklist: 'references/notion-manual-checklist.md',
    },
    nav: refs.iaGraph.nav,
    operations: planned,
    manualChecklist: ['page-full-width'],
    chromeValidation,
  };

  return {
    ok: chromeValidation.ok,
    provider: 'notion',
    manifest,
    manifestDigest: digest(stableStringify(manifest)),
    blockers: chromeValidation.ok
      ? []
      : chromeValidation.problems.map((problem) => ({
          code: problem.code,
          message: problem.message,
        })),
    refs,
  };
}

/**
 * Validate a persisted mapping before reuse (never trust title alone).
 * @param {{
 *   key: string,
 *   mapping: { id?: string, type?: string, parentKey?: string },
 *   expectedType: 'page' | 'database',
 *   expectedParentKey: string,
 * }} options
 */
export function validateMapping(options) {
  const problems = [];
  if (!options.mapping?.id) {
    problems.push({ code: 'mapping_conflict', message: `${options.key} mapping missing id` });
  }
  if (options.mapping?.type && options.mapping.type !== options.expectedType) {
    problems.push({
      code: 'mapping_conflict',
      message: `${options.key} mapped as ${options.mapping.type}, expected ${options.expectedType}`,
    });
  }
  if (
    options.mapping?.parentKey &&
    options.expectedParentKey &&
    options.mapping.parentKey !== options.expectedParentKey &&
    !(options.expectedParentKey === 'root' && options.mapping.parentKey === 'root')
  ) {
    problems.push({
      code: 'mapping_conflict',
      message: `${options.key} parentKey ${options.mapping.parentKey} != ${options.expectedParentKey}`,
    });
  }
  return { ok: problems.length === 0, problems };
}

/**
 * Validate a provider snapshot against the planned manifest.
 * @param {{
 *   manifest: ReturnType<typeof planProvision>['manifest'],
 *   snapshot: {
 *     rootPageId: string,
 *     objects?: Record<string, { id: string, type: string, parentId?: string, parentKey?: string }>,
 *     inline?: Record<string, boolean>,
 *     chrome?: Record<string, boolean>,
 *   },
 * }} options
 */
export function validateSnapshot(options) {
  const problems = [];
  const { manifest, snapshot } = options;
  if (snapshot.rootPageId !== manifest.root.rootPageId) {
    problems.push({
      code: 'root_boundary_violation',
      message: 'snapshot root does not match configured root',
    });
  }
  const objects = snapshot.objects ?? {};
  for (const op of manifest.operations) {
    if (op.op !== 'ensure_page' && op.op !== 'ensure_database' && op.op !== 'map_supplied_root') {
      continue;
    }
    const found = objects[op.key];
    if (!found) {
      problems.push({ code: 'partial_apply', message: `missing mapped object ${op.key}` });
      continue;
    }
    const expectedType = op.op === 'ensure_database' ? 'database' : 'page';
    if (found.type !== expectedType) {
      problems.push({
        code: 'mapping_conflict',
        message: `${op.key} mapped as ${found.type}, expected ${expectedType}`,
      });
    }
    if (found.parentKey && op.expectedParentKey && found.parentKey !== op.expectedParentKey) {
      problems.push({
        code: 'mapping_conflict',
        message: `${op.key} parent ${found.parentKey} != ${op.expectedParentKey}`,
      });
    }
  }
  for (const op of manifest.operations.filter((o) => o.op === 'set_inline')) {
    if (snapshot.inline && snapshot.inline[op.key] !== true) {
      problems.push({ code: 'schema_drift', message: `${op.key} is not inline` });
    }
  }
  if (snapshot.chrome) {
    for (const op of manifest.operations.filter(
      (o) => o.op === 'write_page_body' && o.key.startsWith('pages.'),
    )) {
      if (snapshot.chrome[op.key] !== true) {
        problems.push({
          code: 'schema_drift',
          message: `${op.key} is missing sidebar chrome`,
        });
      }
    }
  }

  // Enforce body chrome for the active Notion strategy (stacked vs legacy sidebar).
  const catalogTitles = Object.values(snapshot.objects ?? {})
    .filter((o) => o?.type === 'database' && o?.title)
    .map((o) => o.title);
  const chromeValidation = validateManifestSidebarChrome({
    operations: manifest.operations,
    nav: manifest.nav,
    sourcesStrategy: manifest.sourcesStrategy,
    homeStack: manifest.homeStack,
    catalogTitles:
      catalogTitles.length > 0
        ? catalogTitles
        : (manifest.operations ?? [])
            .filter((op) => op.op === 'ensure_database')
            .map((op) => op.payload?.title)
            .filter(Boolean),
  });
  problems.push(...chromeValidation.problems);

  if (snapshot.chromeContent && typeof snapshot.chromeContent === 'object') {
    for (const [key, content] of Object.entries(snapshot.chromeContent)) {
      const result = validateSidebarChrome(String(content), {
        activeKey: key,
        nav: manifest.nav,
      });
      problems.push(...result.problems);
    }
  }

  return { ok: problems.length === 0, problems };
}

/**
 * Merge MCP/agent results into Notion state mappings.
 * @param {{
 *   previous?: Record<string, unknown>,
 *   manifest: ReturnType<typeof planProvision>['manifest'],
 *   manifestDigest: string,
 *   results: Array<{
 *     operationId: string,
 *     status: 'completed' | 'skipped' | 'failed',
 *     object?: { key: string, id: string, type: string, parentKey?: string, url?: string, dataSourceId?: string },
 *   }>,
 * }} options
 */
export function recordResult(options) {
  const previous = options.previous ?? {};
  const mappings = { ...(previous.mappings ?? {}) };
  const completed = [];
  const pending = [];
  for (const result of options.results) {
    if (result.status === 'completed' || result.status === 'skipped') {
      completed.push(result.operationId);
      if (result.object) {
        mappings[result.object.key] = {
          id: result.object.id,
          type: result.object.type,
          ...(result.object.parentKey ? { parentKey: result.object.parentKey } : {}),
          ...(result.object.url ? { url: result.object.url } : {}),
          ...(result.object.dataSourceId ? { dataSourceId: result.object.dataSourceId } : {}),
        };
      }
    } else {
      pending.push(result.operationId);
    }
  }
  const allIds = new Set(options.manifest.operations.map((op) => op.id));
  for (const id of allIds) {
    if (!completed.includes(id) && !pending.includes(id)) pending.push(id);
  }
  return {
    notion: {
      schemaVersion: '1.1',
      schemaDigest: createHash('sha256')
        .update(options.manifestDigest, 'utf8')
        .digest('hex'),
      lastObservedAt: new Date().toISOString(),
      lastManifestDigest: options.manifestDigest,
      mappings,
      pendingOperationIds: pending,
      completedOperationIds: completed,
    },
  };
}

/**
 * @param {{ mcpAvailable?: boolean, authenticated?: boolean, rootAccessible?: boolean }} flags
 */
export function capabilityBlockers(flags = {}) {
  /** @type {Array<{ code: string, message: string }>} */
  const blockers = [];
  if (flags.mcpAvailable === false) {
    blockers.push({
      code: 'capability_missing',
      message: 'Notion MCP is not available in this host',
    });
  }
  if (flags.authenticated === false) {
    blockers.push({
      code: 'authentication_required',
      message: 'Notion MCP authentication is required before writes',
    });
  }
  if (flags.rootAccessible === false) {
    blockers.push({
      code: 'root_inaccessible',
      message: 'Configured Notion root is not accessible',
    });
  }
  return blockers;
}

/**
 * Map a catalog schema property to Notion MCP CREATE TABLE / ALTER COLUMN DDL.
 * @param {{ name: string, type: string, prefix?: string, options?: string[] }} property
 */
export function propertyToNotionDdl(property) {
  const name = `"${String(property.name).replaceAll('"', '')}"`;
  switch (property.type) {
    case 'title':
      return `${name} TITLE`;
    case 'rich_text':
      return `${name} RICH_TEXT`;
    case 'unique_id':
      return property.prefix
        ? `${name} UNIQUE_ID PREFIX '${String(property.prefix).replaceAll("'", '')}'`
        : `${name} UNIQUE_ID`;
    case 'select': {
      const opts = (property.options ?? [])
        .map((o) => `'${String(o).replaceAll("'", '')}'`)
        .join(', ');
      return opts ? `${name} SELECT(${opts})` : `${name} SELECT()`;
    }
    case 'multi_select': {
      const opts = (property.options ?? [])
        .map((o) => `'${String(o).replaceAll("'", '')}'`)
        .join(', ');
      return opts ? `${name} MULTI_SELECT(${opts})` : `${name} MULTI_SELECT()`;
    }
    case 'relation':
      return `${name} RELATION('{{${property.relationSchema ?? 'related'}}}')`;
    default:
      throw new Error(`unsupported Notion property type: ${property.type}`);
  }
}

/**
 * @param {{
 *   skillRoot: string,
 *   kind: string,
 *   title: string,
 *   id?: string,
 *   mappings?: Record<string, { id: string, type: string }>,
 * }} options
 */
export function planCreateDocument(options) {
  const graph = options.skillRoot
    ? loadHandbookIaGraph(options.skillRoot)
    : loadHandbookIaGraph();
  const dbKey = databaseKeyForKind(graph, options.kind);
  if (!dbKey) {
    throw new Error(`unsupported Notion document kind: ${options.kind}`);
  }
  const mapped = options.mappings?.[dbKey];
  // OMD ID is Notion UNIQUE_ID — auto-assigned; do not send it on create.
  const rowKey =
    typeof options.id === 'string' && options.id.trim()
      ? options.id.trim()
      : slugifyTitle(options.title);
  const payload = {
    databaseKey: dbKey,
    title: options.title,
    properties: {
      Title: options.title,
    },
    autoIdProperty: 'OMD ID',
  };
  return {
    ok: true,
    provider: 'notion',
    requiresMappedDatabase: !mapped,
    operation: {
      id: `row:${dbKey}:${rowKey}`,
      key: dbKey,
      op: 'ensure_row',
      dependsOn: mapped ? [] : [`ensure:${dbKey}`],
      expectedParentKey: dbKey,
      desiredDigest: digest(stableStringify(payload)),
      payload,
      mappedDatabaseId: mapped?.id ?? null,
      mcp: {
        tool: 'notion-create-pages',
        parentFrom: 'data_source',
        notes:
          'Create the row with Title (and optional Summary/Status). Do not set OMD ID — UNIQUE_ID is read-only and auto-generated.',
      },
    },
  };
}

function slugifyTitle(title) {
  return String(title)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'row';
}

export {
  renderSidebarPageContent,
  renderStackedHomeContent,
  defaultPageBody,
  resolveActiveSection,
  validateSidebarChrome,
  validateManifestSidebarChrome,
};
