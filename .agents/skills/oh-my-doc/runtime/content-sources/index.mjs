import {
  normalizeContentSource,
  readProject,
} from '../omd-contract.mjs';
import { createLocalAdapter } from './local.mjs';
import {
  capabilityBlockers,
  planCreateDocument as planNotionCreateDocument,
  planProvision as planNotionProvision,
  recordResult as recordNotionResult,
  validateMapping,
  validateSnapshot as validateNotionSnapshot,
  renderSidebarPageContent,
  defaultPageBody,
} from './notion.mjs';
import {
  capabilityBlockers as supabaseCapabilityBlockers,
  planCreateDocument as planSupabaseCreateDocument,
  planProvision as planSupabaseProvision,
  recordResult as recordSupabaseResult,
  validateSnapshot as validateSupabaseSnapshot,
  containsForbiddenSecrets,
  SUPABASE_SCHEMA_VERSION,
} from './supabase.mjs';
import { parseNotionRoot } from './notion-root.mjs';
import { loadNotionReferences } from './load-references.mjs';
import { extractChildBlocks } from './sidebar.mjs';

export { loadNotionReferences, parseNotionRoot, extractChildBlocks };
export {
  capabilityBlockers,
  planNotionCreateDocument,
  planNotionProvision,
  recordNotionResult,
  validateMapping,
  validateNotionSnapshot,
  renderSidebarPageContent,
  defaultPageBody,
};
export {
  supabaseCapabilityBlockers,
  planSupabaseCreateDocument,
  planSupabaseProvision,
  recordSupabaseResult,
  validateSupabaseSnapshot,
  containsForbiddenSecrets,
  SUPABASE_SCHEMA_VERSION,
};

/**
 * Resolve SSOT from flags and/or existing project contract.
 * @param {{
 *   cwd: string,
 *   ssot?: string,
 *   notionRoot?: string,
 *   projectRef?: string,
 * }} options
 */
export function resolveContentSource(options) {
  const existing = readProject(options.cwd);
  const fromContract = existing ? normalizeContentSource(existing) : null;
  const ssot = options.ssot ?? fromContract?.ssot ?? 'local';

  if (ssot !== 'local' && ssot !== 'notion' && ssot !== 'supabase') {
    throw new Error(`unsupported contentSource.ssot: ${ssot}`);
  }

  if (ssot === 'local') {
    return { ssot: 'local', notion: null, supabase: null, contract: existing };
  }

  if (ssot === 'supabase') {
    const projectRef =
      options.projectRef ?? fromContract?.supabase?.projectRef ?? null;
    return {
      ssot: 'supabase',
      notion: null,
      supabase: {
        projectRef,
        schemaVersion: fromContract?.supabase?.schemaVersion ?? SUPABASE_SCHEMA_VERSION,
      },
      contract: existing,
    };
  }

  const rootInput =
    options.notionRoot ??
    fromContract?.notion?.rootPageUrl ??
    fromContract?.notion?.rootPageId;
  if (!rootInput) {
    throw Object.assign(
      new Error('notion SSOT requires --notion-root or contentSource.notion.rootPageId'),
      { code: 'root_inaccessible' },
    );
  }
  const notion = parseNotionRoot(String(rootInput));
  return {
    ssot: 'notion',
    notion: {
      ...notion,
      schemaVersion: fromContract?.notion?.schemaVersion ?? '1.0',
    },
    supabase: null,
    contract: existing,
  };
}

/**
 * @param {'local' | 'notion' | 'supabase'} ssot
 */
export function getContentAdapter(ssot) {
  if (ssot === 'local') return createLocalAdapter();
  if (ssot === 'notion') {
    return {
      ssot: 'notion',
      planProvision: planNotionProvision,
      planCreateDocument: planNotionCreateDocument,
      validateSnapshot: validateNotionSnapshot,
      recordResult: recordNotionResult,
      capabilityBlockers,
    };
  }
  if (ssot === 'supabase') {
    return {
      ssot: 'supabase',
      planProvision: planSupabaseProvision,
      planCreateDocument: planSupabaseCreateDocument,
      validateSnapshot: validateSupabaseSnapshot,
      recordResult: recordSupabaseResult,
      capabilityBlockers: supabaseCapabilityBlockers,
    };
  }
  throw new Error(`unsupported ssot: ${ssot}`);
}
