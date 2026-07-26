import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { detectProject } from './detect.mjs';
export function doctorProject(options) {
    const project = detectProject(options.cwd, {
        ...(options.uiPath ? { uiPath: options.uiPath } : {}),
    });
    const notes = [];
    if (project.empty)
        notes.push('Directory is empty — run `node skills/oh-my-doc/scripts/omd.mjs adopt --yes` to scaffold.');
    if (!project.packageManager)
        notes.push('No package manager lockfile or packageManager field detected.');
    else
        notes.push(`Package manager: ${project.packageManager}`);
    if (project.isWorkspace) {
        notes.push(`Workspace globs: ${project.workspaceGlobs.join(', ') || '(present)'}`);
    }
    else if (!project.empty) {
        notes.push('Not a workspace yet — init can add pnpm-workspace/docs packages.');
    }
    if (project.docsPath)
        notes.push(`Docs app: ${project.docsPath}`);
    else
        notes.push('Missing docs app (expected docs/ or apps/docs/).');
    if (project.uiPath)
        notes.push(`UI package: ${project.uiPath}`);
    else
        notes.push(`Missing UI package (expected ${options.uiPath ?? 'packages/ui'}).`);
    notes.push(project.hasAgentsMd ? 'AGENTS.md present' : 'AGENTS.md missing');
    notes.push(project.agentsHasMarker ? 'AGENTS.md has oh-my-docs marker' : 'AGENTS.md marker missing');
    notes.push(project.hasClaudeMd ? 'CLAUDE.md present' : 'CLAUDE.md missing');
    notes.push(project.claudeHasMarker ? 'CLAUDE.md has oh-my-docs marker' : 'CLAUDE.md marker missing');
    const contentDocs = project.docsPath
        ? join(project.root, project.docsPath, 'content', 'docs')
        : null;
    if (contentDocs && existsSync(contentDocs)) {
        notes.push(`Content SSOT: ${project.docsPath}/content/docs`);
    }
    const ok = project.missing.length === 0;
    if (!ok)
        notes.push(`Missing pieces: ${project.missing.join(', ')}`);
    return { project, ok, notes };
}
