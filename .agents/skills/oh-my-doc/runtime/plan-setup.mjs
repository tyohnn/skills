import { join } from 'node:path';
import { detectProject } from './detect.mjs';
import { readTextIfExists } from './fs-ops.mjs';
import { DEFAULT_AGENTS_MARKER_BODY, DEFAULT_CLAUDE_MARKER_BODY, mergeMarkerBlock } from './markers.mjs';

function op(path, kind, reason, content, conflict) {
  return {
    path,
    kind,
    reason,
    ...(content !== undefined ? { content } : {}),
    ...(conflict ? { conflict: true } : {}),
  };
}

/**
 * Plan marker updates only.
 * Skill discovery paths are installed by `npx skills add` (symlink by default).
 * Adopt must not copy the skill tree into cursor/claude/agents directories.
 */
export function planSetup(options) {
  const project = detectProject(options.cwd);
  const operations = [];
  for (const [file, body] of [
    ['AGENTS.md', DEFAULT_AGENTS_MARKER_BODY],
    ['CLAUDE.md', DEFAULT_CLAUDE_MARKER_BODY],
  ]) {
    const existing = readTextIfExists(join(project.root, file));
    const merged = mergeMarkerBlock(existing, body, { force: true });
    if (merged.kind === 'skip') {
      operations.push(op(file, 'skip', 'marker already up to date', merged.content));
    } else {
      operations.push(op(file, merged.kind, 'update oh-my-docs marker block', merged.content));
    }
  }
  const conflicts = operations.filter((item) => item.conflict);
  return { project, operations, conflicts };
}
