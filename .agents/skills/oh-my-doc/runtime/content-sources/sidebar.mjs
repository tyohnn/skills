/**
 * Build and validate Notion-flavored Markdown sidebar chrome for a managed page.
 *
 * Layout contract (enforced by `validateSidebarChrome`):
 * - Two columns (20 / 80) with a gray callout nav on the left
 * - All page body copy and child `<page>` / `<database>` / sources blocks live
 *   in the right column (never below `</columns>`)
 * - Leaf top-level items are bulleted mentions
 * - Parents with children wrap those children in a `<details>` toggle whose
 *   `<summary>` is the parent mention (collapsible sidebar group)
 * - Active section summary gets yellow_bg; active leaf also gets yellow_bg
 *
 * Highlight form Notion round-trips (suffix):
 *   <mention-page url="..."/> {color="yellow_bg"}
 */

/**
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
    const parentHighlight = isActiveParent || key === activeKey;

    if (nested.length > 0) {
      lines.push('\t\t\t<details>');
      lines.push(`\t\t\t<summary>${renderMention(key, mappings, parentHighlight)}</summary>`);
      for (const childKey of nested) {
        lines.push(
          `\t\t\t\t- ${renderMention(childKey, mappings, childKey === activeKey)}`,
        );
      }
      lines.push('\t\t\t</details>');
    } else {
      lines.push(`\t\t\t- ${renderMention(key, mappings, parentHighlight)}`);
    }
  }

  lines.push('\t\t</callout>');
  lines.push('\t</column>');
  lines.push('\t<column ratio="80">');
  for (const line of String(bodyMarkdown).split('\n')) {
    lines.push(line.length ? `\t\t${line}` : '\t\t');
  }
  for (const block of childBlocks) {
    for (const line of String(block).split('\n')) {
      lines.push(line.length ? `\t\t${line}` : '\t\t');
    }
  }
  lines.push('\t</column>');
  lines.push('</columns>');

  return `${lines.join('\n')}\n`;
}

/**
 * Machine-check sidebar chrome against the details-toggle nav contract.
 * @param {string} markdown
 * @param {{
 *   activeKey: string,
 *   nav: { topLevel: string[], nested: Record<string, string[]> },
 *   requirePlaceholders?: boolean,
 * }} options
 * @returns {{ ok: boolean, problems: Array<{ code: string, message: string }> }}
 */
export function validateSidebarChrome(markdown, options) {
  const problems = [];
  const text = String(markdown ?? '');
  const activeKey = options.activeKey;
  const nav = options.nav;
  const activeSection = resolveActiveSection(activeKey, nav);
  const nested = nav.nested[activeSection] ?? [];

  if (!text.includes('<columns>')) {
    problems.push({ code: 'chrome_missing_columns', message: `${activeKey}: missing <columns>` });
  }
  if (!/ratio="20"/.test(text) || !/ratio="80"/.test(text)) {
    problems.push({
      code: 'chrome_column_ratios',
      message: `${activeKey}: expected column ratios 20/80`,
    });
  }
  if (!/<callout\b[^>]*color="gray_bg"/.test(text)) {
    problems.push({
      code: 'chrome_missing_callout',
      message: `${activeKey}: missing gray_bg callout nav`,
    });
  }

  const rightColumn = extractRightColumn(text);
  if (!rightColumn) {
    problems.push({
      code: 'chrome_missing_right_column',
      message: `${activeKey}: missing right column ratio="80"`,
    });
  } else if (!/#\s+\S+/.test(rightColumn)) {
    problems.push({
      code: 'chrome_empty_right_column',
      message: `${activeKey}: right column must contain page body content`,
    });
  }

  const trailing = contentAfterColumns(text);
  if (/<(?:page|database|details)\b/.test(trailing)) {
    problems.push({
      code: 'chrome_content_outside_right_column',
      message: `${activeKey}: page/database/details content must live inside the right column, not after </columns>`,
    });
  }

  for (const key of nav.topLevel) {
    if (!mentionPresent(text, key)) {
      problems.push({
        code: 'chrome_missing_nav_item',
        message: `${activeKey}: top-level nav missing ${key}`,
      });
    }
  }

  // Every parent with children must be a details toggle group.
  for (const [parent, children] of Object.entries(nav.nested)) {
    const block = extractDetailsBlock(text, parent);
    if (!block) {
      problems.push({
        code: 'chrome_missing_details_toggle',
        message: `${activeKey}: ${parent} must wrap children in a <details> toggle`,
      });
      continue;
    }
    if (!summaryMentions(block.summary, parent)) {
      problems.push({
        code: 'chrome_missing_details_summary',
        message: `${activeKey}: details summary for ${parent} must mention ${parent}`,
      });
    }
    for (const childKey of children) {
      if (!block.body.includes(childKey) && !mentionPresent(block.body, childKey)) {
        problems.push({
          code: 'chrome_missing_nested_child',
          message: `${activeKey}: details for ${parent} must include child ${childKey}`,
        });
      }
    }
  }

  if (!parentYellowPresent(text, activeSection)) {
    problems.push({
      code: 'chrome_missing_yellow_group',
      message: `${activeKey}: active section ${activeSection} must have yellow_bg`,
    });
  }

  if (nested.length > 0) {
    if (nested.includes(activeKey) && !childYellowPresent(text, activeKey)) {
      problems.push({
        code: 'chrome_missing_yellow_leaf',
        message: `${activeKey}: active nested page must have yellow_bg`,
      });
    }
  } else if (activeKey === activeSection && !parentYellowPresent(text, activeKey)) {
    problems.push({
      code: 'chrome_missing_yellow_leaf',
      message: `${activeKey}: active top-level page must have yellow_bg`,
    });
  }

  return { ok: problems.length === 0, problems };
}

/**
 * Validate every write_page_body payload in a provision manifest.
 * @param {{
 *   operations: Array<{ op: string, key: string, payload?: { content?: string } }>,
 *   nav: { topLevel: string[], nested: Record<string, string[]> },
 * }} options
 */
export function validateManifestSidebarChrome(options) {
  const problems = [];
  for (const op of options.operations) {
    if (op.op !== 'write_page_body' || !op.key.startsWith('pages.')) continue;
    const content = op.payload?.content;
    if (!content) {
      problems.push({
        code: 'chrome_missing_body',
        message: `${op.key}: write_page_body missing content`,
      });
      continue;
    }
    const result = validateSidebarChrome(content, {
      activeKey: op.key,
      nav: options.nav,
    });
    problems.push(...result.problems);
  }
  return { ok: problems.length === 0, problems };
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

function extractRightColumn(text) {
  const match = /<column ratio="80">([\s\S]*?)<\/column>\s*<\/columns>/.exec(text);
  return match?.[1] ?? null;
}

function contentAfterColumns(text) {
  const marker = '</columns>';
  const idx = text.indexOf(marker);
  if (idx < 0) return '';
  return text.slice(idx + marker.length).trim();
}

function mentionPresent(text, key) {
  return (
    text.includes(`url="{{${key}}}"`) ||
    text.includes(`url="https://app.notion.com/p/${key}"`) ||
    new RegExp(`url="[^"]*${escapeRegExp(key)}[^"]*"`).test(text)
  );
}

function summaryMentions(summary, key) {
  return mentionPresent(summary, key);
}

/**
 * @param {string} text
 * @param {string} parentKey
 * @returns {{ summary: string, body: string } | null}
 */
function extractDetailsBlock(text, parentKey) {
  const keyPattern = `(?:\\{\\{${escapeRegExp(parentKey)}\\}\\}|[^"\\n]*${escapeRegExp(parentKey)}[^"\\n]*)`;
  const re = new RegExp(
    String.raw`<details>\s*<summary>([\s\S]*?url="${keyPattern}"[\s\S]*?)</summary>([\s\S]*?)</details>`,
    'm',
  );
  const match = re.exec(text);
  if (!match) return null;
  return { summary: match[1] ?? '', body: match[2] ?? '' };
}

function parentYellowPresent(text, key) {
  // Yellow may be on a leaf bullet or on a details summary mention.
  const patterns = [
    new RegExp(
      String.raw`<summary><mention-page url="(?:\{\{${escapeRegExp(key)}\}\}|[^"]*${escapeRegExp(key)}[^"]*)"/> \{color="yellow_bg"\}</summary>`,
    ),
    new RegExp(
      String.raw`^\t\t\t- <mention-page url="(?:\{\{${escapeRegExp(key)}\}\}|[^"]*${escapeRegExp(key)}[^"]*)"/> \{color="yellow_bg"\}`,
      'm',
    ),
  ];
  return patterns.some((re) => re.test(text));
}

function childYellowPresent(text, key) {
  const patterns = [
    new RegExp(
      String.raw`^\t\t\t\t- <mention-page url="(?:\{\{${escapeRegExp(key)}\}\}|[^"]*${escapeRegExp(key)}[^"]*)"/> \{color="yellow_bg"\}`,
      'm',
    ),
  ];
  return patterns.some((re) => re.test(text));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
    'pages.home':
      '# Home\nOh My Docs handbook entry point. Use the left nav to reach Vision, Workflow, Domain, Planning, Spec, Plans, and ADRs.',
    'pages.vision': '# Vision\nProduct intent and long-term direction for this handbook.',
    'pages.starting': '# Start here\nShortest path into the docs-first workflow.',
    'pages.workflow': '# Workflow\nPlanning and development contracts for agents and humans.',
    'pages.workflow-planning':
      '# Workflow Planning\nHow discovery becomes an approved plan before code.',
    'pages.development': '# Development\nHow implementation stays covered by a ready plan.',
    'pages.domain': '# Domain\nLiving glossary, models, and policies.',
    'pages.glossary':
      '# Glossary\nStable TERM definitions. Catalog rows live in the inline database below.',
    'pages.models': '# Models\nDomain models. Catalog rows live in the inline database below.',
    'pages.policies':
      '# Policies\nDomain policies. Catalog rows live in the inline database below.',
    'pages.planning': '# Planning\nPRDs and user stories for bounded product changes.',
    'pages.prds':
      '# PRDs\nProduct requirements. Catalog rows live in the inline database below.',
    'pages.stories':
      '# Stories\nUser outcomes. Catalog rows live in the inline database below.',
    'pages.spec': '# Spec\nObservable contracts for data model and system model.',
    'pages.data-model':
      '# Data model\nLiving data contracts. Catalog rows live in the inline database below.',
    'pages.system-model':
      '# System model\nLiving system contracts. Catalog rows live in the inline database below.',
    'pages.plans':
      '# Plans\nImplementation plans. Catalog rows live in the inline database below.',
    'pages.adrs':
      '# ADRs\nArchitecture decisions. Catalog rows live in the inline database below.',
  };
  return bodies[key] ?? `# ${title}\n`;
}
