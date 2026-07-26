import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { hasMarkerBlock } from './markers.mjs';
function readJson(path) {
    try {
        return JSON.parse(readFileSync(path, 'utf8'));
    }
    catch {
        return null;
    }
}
function isDirectoryEmpty(root) {
    if (!existsSync(root))
        return true;
    const entries = readdirSync(root).filter((name) => name !== '.git' && name !== '.DS_Store');
    return entries.length === 0;
}
function detectPackageManager(root, pkg) {
    if (existsSync(join(root, 'pnpm-lock.yaml')) || existsSync(join(root, 'pnpm-workspace.yaml'))) {
        return 'pnpm';
    }
    if (existsSync(join(root, 'yarn.lock')))
        return 'yarn';
    if (existsSync(join(root, 'bun.lockb')) || existsSync(join(root, 'bun.lock')))
        return 'bun';
    if (existsSync(join(root, 'package-lock.json')))
        return 'npm';
    const field = pkg?.packageManager;
    if (typeof field === 'string') {
        if (field.startsWith('pnpm@'))
            return 'pnpm';
        if (field.startsWith('yarn@'))
            return 'yarn';
        if (field.startsWith('npm@'))
            return 'npm';
        if (field.startsWith('bun@'))
            return 'bun';
    }
    return pkg ? 'npm' : null;
}
function parsePnpmWorkspaceGlobs(text) {
    const globs = [];
    let inPackages = false;
    for (const raw of text.split('\n')) {
        const line = raw.replace(/\s+#.*$/, '');
        if (/^\s*packages\s*:\s*$/.test(line)) {
            inPackages = true;
            continue;
        }
        if (inPackages) {
            if (/^\S/.test(line) && !/^\s*-\s+/.test(line)) {
                inPackages = false;
                continue;
            }
            const match = /^\s*-\s*["']?([^"'#]+?)["']?\s*$/.exec(line);
            if (match?.[1])
                globs.push(match[1].trim());
        }
    }
    return globs;
}
function workspaceGlobs(root, pkg) {
    const workspaceFile = join(root, 'pnpm-workspace.yaml');
    if (existsSync(workspaceFile)) {
        return parsePnpmWorkspaceGlobs(readFileSync(workspaceFile, 'utf8'));
    }
    if (Array.isArray(pkg?.workspaces))
        return pkg.workspaces;
    if (pkg?.workspaces && typeof pkg.workspaces === 'object' && Array.isArray(pkg.workspaces.packages)) {
        return pkg.workspaces.packages;
    }
    return [];
}
function findDocsPath(root) {
    const candidates = ['docs', 'apps/docs'];
    for (const candidate of candidates) {
        const content = join(root, candidate, 'content', 'docs');
        if (existsSync(content) && statSync(content).isDirectory())
            return candidate;
    }
    return null;
}
function findUiPath(root, preferred) {
    if (preferred) {
        const preferredPkg = join(root, preferred, 'package.json');
        if (existsSync(preferredPkg))
            return preferred;
    }
    const candidates = ['packages/ui', 'packages/docs-ui'];
    for (const candidate of candidates) {
        const pkgPath = join(root, candidate, 'package.json');
        if (!existsSync(pkgPath))
            continue;
        const pkg = readJson(pkgPath);
        if (pkg?.name === '@oh-my-docs/ui' || existsSync(join(root, candidate, 'src'))) {
            return candidate;
        }
    }
    return null;
}
export function detectProject(cwd, options = {}) {
    const root = resolve(cwd);
    const empty = isDirectoryEmpty(root);
    const packageJsonPath = join(root, 'package.json');
    const hasPackageJson = existsSync(packageJsonPath);
    const pkg = hasPackageJson ? readJson(packageJsonPath) : null;
    const packageManager = detectPackageManager(root, pkg);
    const globs = workspaceGlobs(root, pkg);
    const isWorkspace = globs.length > 0 || existsSync(join(root, 'pnpm-workspace.yaml'));
    const agentsPath = join(root, 'AGENTS.md');
    const claudePath = join(root, 'CLAUDE.md');
    const hasAgentsMd = existsSync(agentsPath);
    const hasClaudeMd = existsSync(claudePath);
    const agentsHasMarker = hasAgentsMd ? hasMarkerBlock(readFileSync(agentsPath, 'utf8')) : false;
    const claudeHasMarker = hasClaudeMd ? hasMarkerBlock(readFileSync(claudePath, 'utf8')) : false;
    const docsPath = findDocsPath(root);
    const uiPath = findUiPath(root, options.uiPath);
    const missing = [];
    if (!hasPackageJson && !empty)
        missing.push('package.json');
    if (!docsPath)
        missing.push('docs app');
    if (!uiPath)
        missing.push('ui package');
    if (!hasAgentsMd)
        missing.push('AGENTS.md');
    if (!hasClaudeMd)
        missing.push('CLAUDE.md');
    if (hasAgentsMd && !agentsHasMarker)
        missing.push('AGENTS.md marker');
    if (hasClaudeMd && !claudeHasMarker)
        missing.push('CLAUDE.md marker');
    return {
        root,
        empty,
        hasPackageJson,
        packageManager,
        isWorkspace,
        workspaceGlobs: globs,
        hasAgentsMd,
        hasClaudeMd,
        agentsHasMarker,
        claudeHasMarker,
        docsPath,
        uiPath,
        missing,
    };
}
export function listFilesRecursive(directory) {
    if (!existsSync(directory))
        return [];
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist')
                return [];
            return listFilesRecursive(path);
        }
        return [path];
    });
}
export function relativePosix(from, to) {
    return relative(from, to).split('\\').join('/');
}
