import { parseFrontmatter } from './planning.mjs';
/**
 * Repo-relative plan paths under either `apps/docs` (this monorepo) or `docs`
 * (default scaffold).
 */
// Accept top-level `plans/` and legacy `development/plans/` during IA migration.
const PLAN_PATH_RE =
  /^(?:apps\/)?docs\/content\/docs\/(?:development\/)?plans\/[a-z0-9][a-z0-9-]*\.mdx$/;
const DOCUMENTATION_ONLY_PREFIXES = [
    'apps/docs/content/docs/',
    'docs/content/docs/',
    'apps/docs/templates/',
    'docs/templates/',
    'templates/default/docs/content/docs/',
    'templates/default/docs/templates/',
    'skills/oh-my-doc/templates/default/docs/content/docs/',
    'skills/oh-my-doc/templates/default/docs/templates/',
    'skills/oh-my-doc/references/',
    'skills/oh-my-doc/assets/',
];
const DOCUMENTATION_ONLY_FILES = new Set([
    'README.md',
    'CHANGELOG.md',
    'apps/docs/content/docs/meta.json',
    'docs/content/docs/meta.json',
]);
export function extractPlanPath(prBody) {
    const match = /^\s*(?:[-*]\s*)?Plan:\s*(.+?)\s*$/im.exec(prBody);
    if (!match?.[1])
        return null;
    const value = match[1].trim().replace(/^`|`$/g, '');
    return PLAN_PATH_RE.test(value) ? value : null;
}
export function isDocumentationOnlyPath(path) {
    const normalized = path.replace(/\\/g, '/');
    if (DOCUMENTATION_ONLY_FILES.has(normalized))
        return true;
    return DOCUMENTATION_ONLY_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}
function coveredBy(path, codeAreas) {
    return codeAreas.some((area) => {
        const normalized = area.replace(/^\.\//, '').replace(/\/$/, '');
        return path === normalized || path.startsWith(`${normalized}/`);
    });
}
export function gateScriptExistsOnBase(readBaseFile) {
    // Only the skill-era `.mjs` gate counts. Legacy `scripts/check-docs-first.ts`
    // (packages/core) must not mark the gate "present", or the PR that migrates
    // the gate itself cannot bootstrap and would require a Plan that cannot yet
    // exist on the pre-migration base.
    for (const candidate of [
        'scripts/check-docs-first.mjs',
        'skills/oh-my-doc/runtime/docs-first.mjs',
    ]) {
        try {
            readBaseFile(candidate);
            return true;
        }
        catch {
            // try next
        }
    }
    return false;
}
/**
 * Validate that implementation changes are authorized by a plan that already
 * exists on the PR base with stage ready|active and covering codeAreas.
 */
export function validateDocsFirst(input) {
    const implementationPaths = input.changedPaths.filter((path) => !isDocumentationOnlyPath(path));
    if (implementationPaths.length === 0)
        return [];
    const gatePresent = input.gatePresentOnBase ?? gateScriptExistsOnBase(input.readBaseFile);
    // While the gate is being introduced, never enforce — even if the PR body
    // already cites a Plan that only exists on the head SHA.
    if (!gatePresent)
        return [];
    const planPath = extractPlanPath(input.prBody);
    if (!planPath) {
        return [
            'code changes require a valid `Plan: docs/content/docs/plans/plan-*.mdx` ' +
                '(or `apps/docs/...`) entry',
        ];
    }
    let source;
    try {
        source = input.readBaseFile(planPath);
    }
    catch {
        return [
            `${planPath}: plan does not exist on the PR base SHA; merge the planning PR first`,
        ];
    }
    let data;
    try {
        data = parseFrontmatter(source, planPath);
    }
    catch (error) {
        return [error instanceof Error ? error.message : String(error)];
    }
    const problems = [];
    const id = typeof data.id === 'string' ? data.id : undefined;
    if (!id || !id.toUpperCase().startsWith('PLAN-')) {
        problems.push(`${planPath}: base plan is missing a PLAN-* id`);
    }
    if (data.stage !== 'ready' && data.stage !== 'active') {
        problems.push(`${planPath}: base plan stage must be ready or active (found ${String(data.stage ?? '?')})`);
    }
    const codeAreas = Array.isArray(data.codeAreas)
        ? data.codeAreas.filter((area) => typeof area === 'string' && area.length > 0)
        : [];
    if (codeAreas.length === 0) {
        problems.push(`${planPath}: base plan must declare string codeAreas`);
        return problems;
    }
    for (const path of implementationPaths) {
        if (!coveredBy(path, codeAreas)) {
            problems.push(`${path}: not covered by ${id ?? 'the base plan'} codeAreas`);
        }
    }
    return problems;
}
