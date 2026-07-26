export const MARKER_START = '<!-- oh-my-docs:start -->';
export const MARKER_END = '<!-- oh-my-docs:end -->';
const MARKER_BLOCK = /<!--\s*oh-my-docs:start\s*-->[\s\S]*?<!--\s*oh-my-docs:end\s*-->/g;
export function hasMarkerBlock(source) {
    MARKER_BLOCK.lastIndex = 0;
    return MARKER_BLOCK.test(source);
}
export function wrapMarkerBlock(body) {
    const trimmed = body.replace(/^\n+/, '').replace(/\n+$/, '');
    return `${MARKER_START}\n${trimmed}\n${MARKER_END}`;
}
/**
 * Merge managed marker content into an existing file.
 * - Replaces an existing marker block in place.
 * - Appends a marker block when the file has no marker.
 * - When `force` is false and the file exists without a marker and differs from
 *   a full replacement, callers should treat that as a conflict before calling.
 */
export function mergeMarkerBlock(existing, managedBody, options = {}) {
    const block = wrapMarkerBlock(managedBody);
    if (existing === null) {
        return { content: `${block}\n`, kind: 'create' };
    }
    if (hasMarkerBlock(existing)) {
        const next = existing.replace(MARKER_BLOCK, block);
        if (next === existing)
            return { content: existing, kind: 'skip' };
        return { content: next, kind: 'merge' };
    }
    if (options.force) {
        const trimmed = existing.replace(/\s+$/, '');
        const content = trimmed.length > 0 ? `${trimmed}\n\n${block}\n` : `${block}\n`;
        return { content, kind: 'merge' };
    }
    const trimmed = existing.replace(/\s+$/, '');
    const content = trimmed.length > 0 ? `${trimmed}\n\n${block}\n` : `${block}\n`;
    return { content, kind: 'merge' };
}
export const DEFAULT_AGENTS_MARKER_BODY = `# Oh My Docs

This repository uses a docs-first workflow. Canonical product intent lives in
**one** handbook SSOT — either local docs (\`docs/content/docs\` or
\`apps/docs/content/docs\`) or Notion — never both as authoritative.

## Content source (SSOT)

1. Read \`.omd/project.json\` and use \`contentSource.ssot\` (\`local\` | \`notion\`).
2. Missing \`contentSource\` means \`local\`.
3. If \`.omd/project.json\` is missing, run \`inspect\` / ask the user to choose
   SSOT and \`adopt\` before inventing handbook files.
4. For \`notion\`, edit the mapped Notion handbook (via the host Notion MCP).
   For \`local\`, edit the docs content tree. Do not treat the other side as truth.

## Documentation is always first

Any decision, agreement, requirement, design choice, open question, or new
discussion that should outlive this chat must be written into the selected SSOT
— not left only in conversation.

1. Before and during the talk, check whether the topic already exists in the SSOT.
2. Create or update the matching handbook artifacts as the discussion progresses.
3. Catalog entries (PRD, story, plan, ADR, …) go in the **catalog store** — a
   Notion inline database row or a local catalog folder + \`meta.json\` — never as
   ad-hoc child pages of the parent section. **Planning ≠ Plans**: implementation
   plans belong in Plans (\`dbs.plans\`), not under Planning.
4. Prefer \`node <skill>/scripts/omd.mjs new <kind> --title "…" --yes\` (local)
   or the Notion catalog workflow (notion) over ad-hoc files or chat-only notes.
5. Run \`node <skill>/scripts/omd.mjs check\` after meaningful documentation edits.

## Docs-first gate

1. Classify the change as \`product\`, \`bugfix\`, \`maintenance\`, or docs-only.
2. Product changes require an active PRD, a story, an accepted specification, and a ready plan.
3. Bug fixes require an existing PRD/specification and a ready plan.
4. Maintenance requires a ready plan; add a specification if an observable contract changes.
5. If required documents are missing, create and review a docs-only change first.
6. An implementation PR must reference a plan that already exists on the PR base with \`stage: ready|active\` and covering \`codeAreas\`.
7. Docs-only edits under the docs content/templates trees (plus root \`README.md\` / \`CHANGELOG.md\`) are exempt. There is no general bypass.

Dependency direction:

\`product vision → PRD → story → specification/ADR → implementation plan → code\``;
export const DEFAULT_CLAUDE_MARKER_BODY = `@AGENTS.md

\`AGENTS.md\` is canonical. Apply its docs-first gate before editing code.`;
