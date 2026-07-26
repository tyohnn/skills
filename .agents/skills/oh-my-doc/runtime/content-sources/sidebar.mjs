/**
 * Build Notion-flavored Markdown sidebar chrome for a managed page.
 * Emits yellow_bg in the form Notion round-trips:
 *   <mention-page url="..."/> {color="yellow_bg"}
 *
 * @param {{
 *   activeKey: string,
 *   mappings: Record<string, { id?: string, url?: string }>,
 *   nav: { topLevel: string[], nested: Record<string, string[]> },
 *   bodyMarkdown?: string,
 *   childBlocks?: string[],
 * }} options
 */
export function renderSidebarPageContent(options) {
  const { activeKey, mappings, nav, bodyMarkdown = '', childBlocks = [] } = options;
  const activeSection = resolveActiveSection(activeKey, nav);
  const lines = [];

  lines.push('<columns>');
  lines.push('\t<column ratio="20">');
  lines.push('\t\t<callout icon="📌" color="gray_bg">');

  for (const key of nav.topLevel) {
    const nested = nav.nested[key] ?? [];
    const isActiveParent = key === activeSection;
    lines.push(`\t\t\t${renderMention(key, mappings, isActiveParent)}`);
    if (isActiveParent && nested.length > 0) {
      for (const childKey of nested) {
        lines.push(`\t\t\t\t${renderMention(childKey, mappings, childKey === activeKey)}`);
      }
    }
  }

  lines.push('\t\t</callout>');
  lines.push('\t</column>');
  lines.push('\t<column ratio="80">');
  for (const line of String(bodyMarkdown).split('\n')) {
    lines.push(line.length ? `\t\t${line}` : '\t\t');
  }
  lines.push('\t</column>');
  lines.push('</columns>');

  for (const block of childBlocks) {
    lines.push(block);
  }

  return `${lines.join('\n')}\n`;
}

/**
 * @param {string} pageKey
 * @param {{ nested: Record<string, string[]> }} nav
 */
export function resolveActiveSection(pageKey, nav) {
  if (nav.nested[pageKey]) return pageKey;
  for (const [parent, children] of Object.entries(nav.nested)) {
    if (children.includes(pageKey)) return parent;
  }
  return pageKey;
}

/**
 * @param {string} key
 * @param {Record<string, { id?: string, url?: string }>} mappings
 * @param {boolean} highlight
 */
function renderMention(key, mappings, highlight) {
  const url = resolveUrl(key, mappings);
  const mention = `<mention-page url="${url}"/>`;
  return highlight ? `${mention} {color="yellow_bg"}` : mention;
}

/**
 * @param {string} key
 * @param {Record<string, { id?: string, url?: string }>} mappings
 */
function resolveUrl(key, mappings) {
  const mapped = mappings[key];
  if (!mapped) return `{{${key}}}`;
  if (mapped.url) return mapped.url;
  if (mapped.id) {
    const compact = mapped.id.replaceAll('-', '');
    return `https://app.notion.com/p/${compact}`;
  }
  return `{{${key}}}`;
}

/**
 * Extract preservable child blocks from a fetched Notion page markdown body.
 * @param {string} pageMarkdown
 * @returns {string[]}
 */
export function extractChildBlocks(pageMarkdown) {
  const text = String(pageMarkdown ?? '');
  const blocks = [];
  const pageRe = /<page\b[^>]*>[\s\S]*?<\/page>/g;
  const dbRe = /<database\b[^>]*(?:\/>|>[\s\S]*?<\/database>)/g;
  for (const match of text.match(pageRe) ?? []) blocks.push(match.trim());
  for (const match of text.match(dbRe) ?? []) blocks.push(match.trim());
  return blocks;
}

/**
 * Default short body copy per OMD page key.
 * @param {string} key
 * @param {string} title
 */
export function defaultPageBody(key, title) {
  const bodies = {
    'pages.home': '# Home\nOh My Docs handbook entry point. Use the left nav to reach Vision, Workflow, Domain, Planning, Spec, Plans, and ADRs.',
    'pages.vision': '# Vision\nProduct intent and long-term direction for this handbook.',
    'pages.starting': '# Start here\nShortest path into the docs-first workflow.',
    'pages.workflow': '# Workflow\nPlanning and development contracts for agents and humans.',
    'pages.workflow-planning': '# Workflow Planning\nHow discovery becomes an approved plan before code.',
    'pages.development': '# Development\nHow implementation stays covered by a ready plan.',
    'pages.domain': '# Domain\nLiving glossary, models, and policies.',
    'pages.glossary': '# Glossary\nStable TERM definitions. Catalog rows live in the inline database below.',
    'pages.models': '# Models\nDomain models. Catalog rows live in the inline database below.',
    'pages.policies': '# Policies\nDomain policies. Catalog rows live in the inline database below.',
    'pages.planning': '# Planning\nPRDs and user stories for bounded product changes.',
    'pages.prds': '# PRDs\nProduct requirements. Catalog rows live in the inline database below.',
    'pages.stories': '# Stories\nUser outcomes. Catalog rows live in the inline database below.',
    'pages.spec': '# Spec\nObservable contracts for data model, system model, and CLI.',
    'pages.data-model': '# Data model\nLiving data contracts. Catalog rows live in the inline database below.',
    'pages.system-model': '# System model\nLiving system contracts. Catalog rows live in the inline database below.',
    'pages.cli': '# CLI\nAgent-facing runtime and command contracts.',
    'pages.plans': '# Plans\nImplementation plans. Catalog rows live in the inline database below.',
    'pages.adrs': '# ADRs\nArchitecture decisions. Catalog rows live in the inline database below.',
  };
  return bodies[key] ?? `# ${title}\n`;
}
