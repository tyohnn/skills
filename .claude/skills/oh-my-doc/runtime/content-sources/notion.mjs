import { createHash } from 'node:crypto';

import { digest, stableStringify } from '../omd-contract.mjs';
import { loadNotionReferences } from './load-references.mjs';
import { parseNotionRoot } from './notion-root.mjs';
import {
  defaultPageBody,
  renderSidebarPageContent,
  resolveActiveSection,
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
      object.parent === 'root' ? [] : [`ensure:${object.parent}`];
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
          notes: 'Creates full-page DB; always follow with set_inline when inline=true.',
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

  // 2) Optional root details index listing sources children (sources page is already parent).
  const sourcesKey = refs.iaGraph.sourcesToggle.key;
  operations.push({
    id: 'sources:root-index',
    key: sourcesKey,
    op: 'write_root_sources_index',
    dependsOn: [`ensure:${sourcesKey}`],
    expectedParentKey: 'root',
    title: refs.iaGraph.sourcesToggle.title,
    desiredDigest: digest(stableStringify({ sourcesKey, strategy: refs.iaGraph.sourcesStrategy })),
    payload: {
      strategy: refs.iaGraph.sourcesStrategy ?? 'sources-page-parent',
      sourcesKey,
      children: refs.iaGraph.objects
        .filter((o) => o.parent === sourcesKey && o.kind === 'page')
        .map((o) => o.key),
    },
    mcp: {
      tool: 'notion-update-page',
      notes: 'On handbook root, optional <details> listing managed top-level pages.',
    },
  });

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

  // 4) Write sidebar chrome for every managed page (except sources container).
  const placeholderMappings = Object.fromEntries(
    refs.iaGraph.objects
      .filter((o) => o.kind === 'page' || o.kind === 'database')
      .map((o) => [o.key, { url: `{{${o.key}}}` }]),
  );

  for (const object of refs.iaGraph.objects.filter((o) => o.kind === 'page')) {
    if (object.role === 'sources') {
      operations.push({
        id: `body:${object.key}`,
        key: object.key,
        op: 'write_page_body',
        dependsOn: [`ensure:${object.key}`],
        expectedParentKey: object.parent,
        desiredDigest: digest(`sources-body:${object.key}`),
        payload: {
          key: object.key,
          template: 'sources-container',
          content: '# 데이터 원본\nManaged handbook pages and catalogs live under this container.\n',
        },
        mcp: {
          tool: 'notion-update-page',
          command: 'replace_content',
          notes: 'Preserve child <page> tags when replacing content.',
        },
      });
      continue;
    }

    const childBlocks = [];
    for (const child of refs.iaGraph.objects.filter((o) => o.parent === object.key)) {
      if (child.kind === 'page') {
        childBlocks.push(`<page url="{{${child.key}}}">${child.title}</page>`);
      } else if (child.kind === 'database') {
        childBlocks.push(
          `<database url="{{${child.key}}}" inline="true">${child.title}</database>`,
        );
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
      ],
      expectedParentKey: object.parent,
      desiredDigest: digest(stableStringify({ key: object.key, content })),
      payload,
      mcp: {
        tool: 'notion-update-page',
        command: 'replace_content',
        notes:
          'Required for every pages.* key. Preserve child <page>/<database> blocks. Substitute {{pages.*}}/{{dbs.*}} from state mappings before write.',
      },
    });
  }

  const pending = new Set(options.pendingOperationIds ?? []);
  const planned = operations.map((op) => {
    const mapped = mappings[op.key];
    const mappingCheck = mapped
      ? validateMapping({
          key: op.key,
          mapping: mapped,
          expectedType: objectsByKey[op.key]?.kind === 'database' ? 'database' : 'page',
          expectedParentKey: op.expectedParentKey,
        })
      : null;
    let action = 'create';
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

  const manifest = {
    schemaVersion: '1.1',
    provider: 'notion',
    root,
    sourcesStrategy: refs.iaGraph.sourcesStrategy ?? 'sources-page-parent',
    chrome: refs.iaGraph.chrome ?? { requiredOn: 'all-pages' },
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
  };

  return {
    ok: true,
    provider: 'notion',
    manifest,
    manifestDigest: digest(stableStringify(manifest)),
    blockers: [],
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
    if (op.op !== 'ensure_page' && op.op !== 'ensure_database') continue;
    const found = objects[op.key];
    if (!found) {
      problems.push({ code: 'partial_apply', message: `missing mapped object ${op.key}` });
      continue;
    }
    const expectedType = op.op === 'ensure_page' ? 'page' : 'database';
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
 * @param {{
 *   skillRoot: string,
 *   kind: string,
 *   title: string,
 *   id: string,
 *   mappings?: Record<string, { id: string, type: string }>,
 * }} options
 */
export function planCreateDocument(options) {
  const kindToDb = {
    prd: 'dbs.prds',
    story: 'dbs.stories',
    plan: 'dbs.plans',
    adr: 'dbs.adrs',
    spec: 'dbs.data-model',
  };
  const dbKey = kindToDb[options.kind];
  if (!dbKey) {
    throw new Error(`unsupported Notion document kind: ${options.kind}`);
  }
  const mapped = options.mappings?.[dbKey];
  const payload = {
    databaseKey: dbKey,
    title: options.title,
    omdId: options.id,
  };
  return {
    ok: true,
    provider: 'notion',
    requiresMappedDatabase: !mapped,
    operation: {
      id: `row:${dbKey}:${options.id}`,
      key: dbKey,
      op: 'ensure_row',
      dependsOn: mapped ? [] : [`ensure:${dbKey}`],
      expectedParentKey: dbKey,
      desiredDigest: digest(stableStringify(payload)),
      payload,
      mappedDatabaseId: mapped?.id ?? null,
      mcp: { tool: 'notion-create-pages', parentFrom: 'data_source' },
    },
  };
}

export { renderSidebarPageContent, defaultPageBody, resolveActiveSection };
