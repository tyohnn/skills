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

This repository uses a docs-first workflow. Canonical product intent lives under
\`docs/content/docs\` (or \`apps/docs/content/docs\` when present).

## Docs-first gate

1. Classify the change as \`product\`, \`bugfix\`, \`maintenance\`, or docs-only.
2. Product changes require an active PRD, a story, an accepted specification, and a ready plan.
3. Bug fixes require an existing PRD/specification and a ready plan.
4. Maintenance requires a ready plan; add a specification if an observable contract changes.
5. If required documents are missing, create and review a docs-only change first.
6. An implementation PR must reference a plan that already exists on the PR base with \`stage: ready|active\` and covering \`codeAreas\`.
7. Docs-only edits under the docs content/templates trees (plus root \`README.md\` / \`CHANGELOG.md\`) are exempt. There is no general bypass.

Dependency direction:

\`product vision → PRD → story → specification/ADR → implementation plan → code\`

Create drafts with \`node <skill>/scripts/omd.mjs new <kind> --title "…" --yes\`.
Run \`node <skill>/scripts/omd.mjs check\` before opening an implementation PR.`;
export const DEFAULT_CLAUDE_MARKER_BODY = `@AGENTS.md

\`AGENTS.md\` is canonical. Apply its docs-first gate before editing code.`;
