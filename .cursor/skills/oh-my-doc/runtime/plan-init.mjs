import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { detectProject, listFilesRecursive, relativePosix } from './detect.mjs';
import { readTextIfExists } from './fs-ops.mjs';
import { DEFAULT_AGENTS_MARKER_BODY, DEFAULT_CLAUDE_MARKER_BODY, hasMarkerBlock, mergeMarkerBlock, } from './markers.mjs';
function op(path, kind, reason, content, conflict) {
    return {
        path,
        kind,
        reason,
        ...(content !== undefined ? { content } : {}),
        ...(conflict ? { conflict: true } : {}),
    };
}
function decideWrite(root, relativePath, content, reason, force) {
    const absolute = join(root, relativePath);
    const existing = readTextIfExists(absolute);
    if (existing === null)
        return op(relativePath, 'create', reason, content);
    if (existing === content)
        return op(relativePath, 'skip', 'already up to date', content);
    if (force)
        return op(relativePath, 'update', `${reason} (forced)`, content);
    return op(relativePath, 'skip', 'exists with different content', content, true);
}
function rootPackageJson(name, packageManager) {
    return `${JSON.stringify({
        name,
        private: true,
        type: 'module',
        packageManager: `${packageManager}@${packageManager === 'pnpm' ? '11.5.2' : '10.0.0'}`,
        engines: { node: '>=24.0.0' },
        scripts: {
            build: 'turbo run build',
            dev: 'turbo run dev',
            test: 'turbo run test',
            typecheck: 'turbo run typecheck',
            'check:planning': 'node skills/oh-my-doc/scripts/omd.mjs check',
        },
        devDependencies: {
            '@types/node': '^26.1.1',
            turbo: '^2.10.5',
            typescript: '^5.9.3',
        },
    }, null, 2)}\n`;
}
function pnpmWorkspace() {
    return `packages:\n  - "docs"\n  - "packages/*"\n\nallowBuilds:\n  esbuild: true\n  sharp: true\n`;
}
function turboJson() {
    return `${JSON.stringify({
        $schema: 'https://turbo.build/schema.json',
        tasks: {
            dev: { cache: false, persistent: true },
            build: { dependsOn: ['^build'], outputs: ['.next/**', '!.next/cache/**', 'dist/**'] },
            test: { dependsOn: ['^build'] },
            typecheck: { dependsOn: ['^build'] },
        },
    }, null, 2)}\n`;
}
function tsconfigBase() {
    return `${JSON.stringify({
        $schema: 'https://json.schemastore.org/tsconfig',
        compilerOptions: {
            target: 'ESNext',
            module: 'ESNext',
            moduleResolution: 'Bundler',
            strict: true,
            noUncheckedIndexedAccess: true,
            exactOptionalPropertyTypes: true,
            verbatimModuleSyntax: true,
            skipLibCheck: true,
        },
    }, null, 2)}\n`;
}
function gitignore() {
    return [
        'node_modules/',
        '.pnpm-store/',
        '.turbo/',
        '.next/',
        'docs/.source/',
        '*.tsbuildinfo',
        '.DS_Store',
        '.env*',
        '!.env.example',
        '',
    ].join('\n');
}
function ensureWorkspaceGlob(existing, required) {
    const lines = existing.split('\n');
    const missing = required.filter((glob) => !existing.includes(glob));
    if (missing.length === 0)
        return existing;
    const packagesIndex = lines.findIndex((line) => line.trim() === 'packages:');
    if (packagesIndex === -1) {
        return `${existing.replace(/\s+$/, '')}\n\npackages:\n${missing.map((g) => `  - "${g}"`).join('\n')}\n`;
    }
    const insertAt = packagesIndex + 1;
    const additions = missing.map((g) => `  - "${g}"`);
    return [...lines.slice(0, insertAt), ...additions, ...lines.slice(insertAt)].join('\n');
}
function projectName(state) {
    try {
        const pkg = JSON.parse(readFileSync(join(state.root, 'package.json'), 'utf8'));
        if (typeof pkg.name === 'string' && pkg.name.length > 0)
            return pkg.name;
    }
    catch {
        // fall through
    }
    const base = state.root.split(/[/\\]/).filter(Boolean).at(-1);
    return base && base.length > 0 ? base : 'docs-workspace';
}
/**
 * Build a deterministic init plan from a template directory and project state.
 * Template files are copied unless they conflict; AGENTS/CLAUDE use marker merge.
 */
export function planInit(options, templateRoot) {
    const uiPath = options.uiPath ?? 'packages/ui';
    const force = options.force === true;
    const project = detectProject(options.cwd, { uiPath });
    const packageManager = options.packageManager ?? project.packageManager ?? 'pnpm';
    const operations = [];
    if (!existsSync(templateRoot)) {
        throw new Error(`template not found: ${templateRoot}`);
    }
    if (project.empty || !project.hasPackageJson) {
        operations.push(decideWrite(project.root, 'package.json', rootPackageJson(projectName(project), packageManager), 'scaffold root package.json', force));
    }
    if (packageManager === 'pnpm') {
        const workspacePath = join(project.root, 'pnpm-workspace.yaml');
        const required = ['docs', 'packages/*'];
        if (!existsSync(workspacePath)) {
            operations.push(decideWrite(project.root, 'pnpm-workspace.yaml', pnpmWorkspace(), 'scaffold workspace', force));
        }
        else {
            const current = readFileSync(workspacePath, 'utf8');
            const next = ensureWorkspaceGlob(current, required);
            operations.push(decideWrite(project.root, 'pnpm-workspace.yaml', next, 'ensure workspace globs', force));
        }
    }
    if (!existsSync(join(project.root, 'turbo.json'))) {
        operations.push(decideWrite(project.root, 'turbo.json', turboJson(), 'scaffold turbo', force));
    }
    if (!existsSync(join(project.root, 'tsconfig.base.json'))) {
        operations.push(decideWrite(project.root, 'tsconfig.base.json', tsconfigBase(), 'scaffold tsconfig base', force));
    }
    const gitignoreDest = 'gitignore';
    const templateGitignore = join(templateRoot, gitignoreDest);
    const gitignoreContent = existsSync(templateGitignore)
        ? readFileSync(templateGitignore, 'utf8')
        : gitignore();
    operations.push(decideWrite(project.root, '.gitignore', gitignoreContent, 'scaffold gitignore', force));
    // Copy template tree except root meta files handled above and packages/ui remap.
    const templateFiles = listFilesRecursive(templateRoot);
    for (const absolute of templateFiles) {
        let rel = relativePosix(templateRoot, absolute);
        if (rel === 'package.json' || rel === 'pnpm-workspace.yaml' || rel === 'turbo.json')
            continue;
        if (rel === 'tsconfig.base.json' || rel === 'gitignore' || rel === '.gitignore')
            continue;
        if (rel === 'AGENTS.md' || rel === 'CLAUDE.md')
            continue;
        if (rel.startsWith('packages/ui/') || rel === 'packages/ui') {
            rel = rel.replace(/^packages\/ui/, uiPath);
        }
        // Prefer docs/ as the product docs app path in scaffolds.
        const content = readFileSync(absolute, 'utf8');
        operations.push(decideWrite(project.root, rel, content, 'scaffold from template', force));
    }
    // Marker-managed instruction files
    for (const [file, body] of [
        ['AGENTS.md', DEFAULT_AGENTS_MARKER_BODY],
        ['CLAUDE.md', DEFAULT_CLAUDE_MARKER_BODY],
    ]) {
        const existing = readTextIfExists(join(project.root, file));
        if (existing !== null && !hasMarkerBlock(existing) && !force) {
            // Append merge is still safe; only full overwrite would be a conflict.
            const merged = mergeMarkerBlock(existing, body, { force: true });
            if (merged.content === existing) {
                operations.push(op(file, 'skip', 'already up to date'));
            }
            else {
                operations.push(op(file, 'merge', 'append oh-my-docs marker block', merged.content));
            }
            continue;
        }
        const merged = mergeMarkerBlock(existing, body, { force });
        if (merged.kind === 'skip') {
            operations.push(op(file, 'skip', 'already up to date', merged.content));
        }
        else {
            operations.push(op(file, merged.kind, 'install oh-my-docs marker block', merged.content));
        }
    }
    const conflicts = operations.filter((item) => item.conflict);
    return { project, operations, conflicts };
}
export function resolveInitTarget(cwd) {
    return resolve(cwd);
}
