import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectProject, listFilesRecursive, relativePosix } from './detect.mjs';
import { readTextIfExists } from './fs-ops.mjs';
import { DEFAULT_AGENTS_MARKER_BODY, DEFAULT_CLAUDE_MARKER_BODY, mergeMarkerBlock, } from './markers.mjs';
import { agentsFor, skillInstallRoot } from './skill-paths.mjs';
function op(path, kind, reason, content, conflict) {
    return {
        path,
        kind,
        reason,
        ...(content !== undefined ? { content } : {}),
        ...(conflict ? { conflict: true } : {}),
    };
}
function isAbsolutePath(path) {
    return path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path);
}
function decideSkillWrite(absolutePath, displayPath, content, force) {
    const existing = readTextIfExists(absolutePath);
    if (existing === null)
        return op(displayPath, 'create', 'install agent setup skill', content);
    if (existing === content)
        return op(displayPath, 'skip', 'setup skill already up to date', content);
    if (force)
        return op(displayPath, 'update', 'refresh agent setup skill', content);
    return op(displayPath, 'skip', 'setup skill exists with different content', content, true);
}
function planSkillTree(skillRoot, installAbsolute, displayRoot, force) {
    const files = listFilesRecursive(skillRoot);
    if (files.length === 0) {
        return [
            op(displayRoot, 'skip', `setup skill source missing or empty at ${skillRoot}`, undefined, true),
        ];
    }
    return files.map((absoluteSource) => {
        const rel = relativePosix(skillRoot, absoluteSource);
        const content = readFileSync(absoluteSource, 'utf8');
        const absoluteDest = join(installAbsolute, rel);
        const displayPath = isAbsolutePath(displayRoot)
            ? join(displayRoot, rel)
            : `${displayRoot}/${rel}`;
        return decideSkillWrite(absoluteDest, displayPath, content, force);
    });
}
/**
 * Plan marker updates and official agent discovery-path skill installs.
 * Skills are copied from `skillRoot` (shared setup skill tree).
 */
export function planSetup(options) {
    const force = options.force === true;
    const scope = options.scope ?? 'project';
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
        }
        else {
            operations.push(op(file, merged.kind, 'update oh-my-docs marker block', merged.content));
        }
    }
    const skillRoot = options.skillRoot;
    if (!skillRoot || !existsSync(join(skillRoot, 'SKILL.md'))) {
        operations.push(op('(setup skill)', 'skip', skillRoot
            ? `setup skill source missing SKILL.md at ${skillRoot}`
            : 'setup skill source not provided', undefined, true));
    }
    else {
        for (const agent of agentsFor(options.agent)) {
            const target = options.home !== undefined
                ? skillInstallRoot(agent, scope, project.root, options.home)
                : skillInstallRoot(agent, scope, project.root);
            operations.push(...planSkillTree(skillRoot, target.absolute, target.displayPath, force));
        }
    }
    const conflicts = operations.filter((item) => item.conflict);
    return { project, operations, conflicts };
}
