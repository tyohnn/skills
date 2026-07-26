import { readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { parseFrontmatter } from './frontmatter.mjs';
export { parseFrontmatter };
const PRD_STATUSES = ['draft', 'active', 'done'];
const SPEC_STAGES = ['draft', 'accepted', 'superseded'];
const ADR_STAGES = ['accepted', 'locked', 'superseded'];
const PLAN_STAGES = ['draft', 'ready', 'active', 'done', 'superseded'];
const PLAN_CHANGE_TYPES = ['product', 'bugfix', 'maintenance'];
const PREFIX = {
    prd: 'PRD-',
    story: 'US-',
    spec: 'SPEC-',
    adr: 'ADR-',
    plan: 'PLAN-',
};
function walk(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? walk(path) : path.endsWith('.mdx') ? [path] : [];
    });
}
function string(value) {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}
function strings(value) {
    return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : [];
}
function nonEmptyStrings(value) {
    if (!Array.isArray(value))
        return null;
    if (!value.every((item) => typeof item === 'string' && item.length > 0))
        return null;
    return value;
}
function classify(file, contentDirectory, data) {
    const path = relative(contentDirectory, file).replaceAll('\\', '/');
    if (basename(file) === 'index.mdx')
        return null;
    if (path.startsWith('planning/prds/'))
        return 'prd';
    if (path.startsWith('planning/stories/'))
        return 'story';
    if (path.startsWith('plans/'))
        return 'plan';
    if (path.startsWith('adr/'))
        return 'adr';
    return string(data.id)?.toUpperCase().startsWith('SPEC-') ? 'spec' : null;
}
export function collectPlanningDocuments(contentDirectory) {
    const documents = [];
    const problems = [];
    for (const file of walk(contentDirectory)) {
        const path = relative(contentDirectory, file).replaceAll('\\', '/');
        let data;
        try {
            data = parseFrontmatter(readFileSync(file, 'utf8'), path);
        }
        catch (error) {
            problems.push(error instanceof Error ? error.message : String(error));
            continue;
        }
        const kind = classify(file, contentDirectory, data);
        if (!kind)
            continue;
        const id = string(data.id);
        if (!id) {
            problems.push(`${path}: ${kind} document is missing id`);
            continue;
        }
        if (!id.toUpperCase().startsWith(PREFIX[kind])) {
            problems.push(`${path}: ${kind} id must start with ${PREFIX[kind]} (found ${id})`);
        }
        const title = string(data.title);
        if (!title) {
            problems.push(`${path}: ${kind} document is missing title`);
        }
        const status = string(data.status);
        const stage = string(data.stage);
        const changeType = string(data.changeType);
        const prd = string(data.prd);
        let specs = strings(data.specs);
        let stories = strings(data.stories);
        let codeAreas = strings(data.codeAreas);
        if (data.specs !== undefined && nonEmptyStrings(data.specs) === null) {
            problems.push(`${path}: specs must be an array of non-empty strings`);
            specs = [];
        }
        if (data.stories !== undefined && nonEmptyStrings(data.stories) === null) {
            problems.push(`${path}: stories must be an array of non-empty strings`);
            stories = [];
        }
        if (data.codeAreas !== undefined && nonEmptyStrings(data.codeAreas) === null) {
            problems.push(`${path}: codeAreas must be an array of non-empty strings`);
            codeAreas = [];
        }
        documents.push({
            file: path,
            slug: basename(file, '.mdx'),
            kind,
            id,
            ...(title ? { title } : {}),
            ...(status ? { status } : {}),
            ...(stage ? { stage } : {}),
            ...(changeType ? { changeType } : {}),
            ...(prd ? { prd } : {}),
            specs,
            stories,
            codeAreas,
        });
    }
    return { documents, problems };
}
function checkNavigation(contentDirectory, document, problems) {
    const metaPath = join(contentDirectory, dirname(document.file), 'meta.json');
    try {
        const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
        const pages = typeof meta === 'object' && meta !== null && !Array.isArray(meta)
            ? meta.pages
            : undefined;
        if (!Array.isArray(pages) || !pages.includes(document.slug)) {
            problems.push(`${document.file}: ${document.slug} is not registered in sibling meta.json`);
        }
    }
    catch {
        problems.push(`${document.file}: sibling meta.json is missing or invalid`);
    }
}
export function validatePlanning(contentDirectory) {
    const collected = collectPlanningDocuments(contentDirectory);
    const problems = [...collected.problems];
    const byId = new Map();
    for (const document of collected.documents) {
        const prior = byId.get(document.id);
        if (prior)
            problems.push(`${document.file}: duplicate id ${document.id} (also in ${prior.file})`);
        else
            byId.set(document.id, document);
        checkNavigation(contentDirectory, document, problems);
    }
    const requireReference = (owner, id, kind) => {
        const target = byId.get(id);
        if (!target) {
            problems.push(`${owner.file}: ${kind} reference does not exist — ${id}`);
            return undefined;
        }
        if (target.kind !== kind) {
            problems.push(`${owner.file}: ${id} is ${target.kind}, expected ${kind}`);
            return undefined;
        }
        return target;
    };
    for (const document of collected.documents) {
        if (document.kind === 'prd') {
            if (!PRD_STATUSES.includes((document.status ?? ''))) {
                problems.push(`${document.file}: PRD status must be draft, active, or done`);
            }
            for (const story of document.stories)
                requireReference(document, story, 'story');
            continue;
        }
        if (document.kind === 'story') {
            // Stories are catalog entries; lifecycle is owned by the linked PRD/plan.
            continue;
        }
        if (document.kind === 'spec') {
            if (!SPEC_STAGES.includes(document.stage ?? '')) {
                problems.push(`${document.file}: spec stage must be draft, accepted, or superseded`);
            }
            continue;
        }
        if (document.kind === 'adr') {
            if (!ADR_STAGES.includes(document.stage ?? '')) {
                problems.push(`${document.file}: adr stage must be accepted, locked, or superseded`);
            }
            continue;
        }
        if (document.kind !== 'plan')
            continue;
        if (!PLAN_STAGES.includes((document.stage ?? ''))) {
            problems.push(`${document.file}: plan stage must be draft, ready, active, done, or superseded`);
        }
        if (!PLAN_CHANGE_TYPES.includes((document.changeType ?? ''))) {
            problems.push(`${document.file}: plan changeType must be product, bugfix, or maintenance`);
        }
        if (document.codeAreas.length === 0) {
            problems.push(`${document.file}: plan must declare at least one codeAreas entry`);
        }
        const needsProductContext = document.changeType === 'product' || document.changeType === 'bugfix';
        if (needsProductContext && !document.prd) {
            problems.push(`${document.file}: ${document.changeType} plan requires prd`);
        }
        if (needsProductContext && document.specs.length === 0) {
            problems.push(`${document.file}: ${document.changeType} plan requires at least one spec`);
        }
        if (document.changeType === 'product' && document.stories.length === 0) {
            problems.push(`${document.file}: product plan requires at least one story`);
        }
        const prd = document.prd ? requireReference(document, document.prd, 'prd') : undefined;
        const specs = document.specs
            .map((id) => requireReference(document, id, 'spec'))
            .filter((item) => item !== undefined);
        for (const story of document.stories)
            requireReference(document, story, 'story');
        // ready|active|done plans may only reference non-draft PRDs and accepted specs.
        if (['ready', 'active', 'done'].includes(document.stage ?? '')) {
            if (prd?.status === 'draft') {
                problems.push(`${document.file}: ${document.stage} plan references draft PRD ${prd.id}`);
            }
            for (const spec of specs) {
                if (spec.stage !== 'accepted') {
                    problems.push(`${document.file}: ${document.stage} plan requires accepted spec ${spec.id} ` +
                        `(found ${spec.stage ?? 'missing'})`);
                }
            }
        }
    }
    return problems;
}
