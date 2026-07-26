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

/**
 * Resolve SSOT from flags and/or existing project contract.
 * @param {{
 *   cwd: string,
 *   ssot?: string,
 *   notionRoot?: string,
 * }} options
 */
export function resolveContentSource(options) {
  const existing = readProject(options.cwd);
  const fromContract = existing ? normalizeContentSource(existing) : null;
  const ssot = options.ssot ?? fromContract?.ssot ?? 'local';

  if (ssot !== 'local' && ssot !== 'notion') {
    throw new Error(`unsupported contentSource.ssot: ${ssot}`);
  }

  if (ssot === 'local') {
    return { ssot: 'local', notion: null, contract: existing };
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
    contract: existing,
  };
}

/**
 * @param {'local' | 'notion'} ssot
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
  throw new Error(`unsupported ssot: ${ssot}`);
}
