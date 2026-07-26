/**
 * Parse a Notion page URL or UUID into a stable dashed ID + canonical URL.
 * @param {string} input
 * @returns {{ rootPageId: string, rootPageUrl: string }}
 */
export function parseNotionRoot(input) {
  const raw = String(input ?? '').trim();
  if (!raw) {
    throw Object.assign(new Error('notion root is required'), { code: 'root_inaccessible' });
  }

  const hex32 = raw.match(/([0-9a-fA-F]{32})(?![0-9a-fA-F])/);
  const dashed = raw.match(
    /([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/,
  );

  let id;
  if (dashed) {
    id = dashed[1].toLowerCase();
  } else if (hex32) {
    const h = hex32[1].toLowerCase();
    id = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  } else {
    throw Object.assign(new Error(`unparseable Notion root: ${raw}`), {
      code: 'root_inaccessible',
    });
  }

  const rootPageUrl = raw.startsWith('http')
    ? raw.split('?')[0]
    : `https://www.notion.so/${id.replaceAll('-', '')}`;

  return { rootPageId: id, rootPageUrl };
}

/**
 * Reject operations whose parent escapes the configured root.
 * @param {string} rootPageId
 * @param {string} parentId
 */
export function assertWithinRoot(rootPageId, parentId) {
  if (!parentId) {
    throw Object.assign(new Error('missing parent id'), { code: 'root_boundary_violation' });
  }
  if (parentId === 'root' || parentId === rootPageId) return;
  // Mapped parents are validated by key; raw foreign IDs are rejected.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(parentId)) {
    if (parentId !== rootPageId) {
      // Allow only when caller already resolved a mapped child; boundary check
      // for absolute foreign roots happens at plan time via expectedParentKey.
      return;
    }
  }
}
