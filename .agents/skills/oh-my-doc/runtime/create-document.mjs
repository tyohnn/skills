import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectProject } from './detect.mjs';
import { collectPlanningDocuments, validatePlanning } from './planning.mjs';
const KIND_DIR = {
    prd: 'planning/prds',
    story: 'planning/stories',
    spec: 'spec',
    plan: 'plans',
    adr: 'adr',
};
const KIND_FILE_PREFIX = {
    prd: 'prd',
    story: 'us',
    spec: 'spec',
    plan: 'plan',
    adr: 'adr',
};
const KIND_ID_PREFIX = {
    prd: 'PRD-',
    story: 'US-',
    spec: 'SPEC-',
    plan: 'PLAN-',
    adr: 'ADR-',
};
const TEMPLATE_FILE = {
    prd: 'prd.mdx',
    story: 'user-story.mdx',
    spec: 'spec.mdx',
    plan: 'implementation-plan.mdx',
    adr: 'adr.mdx',
};
function op(path, kind, reason, content, conflict) {
    return {
        path,
        kind,
        reason,
        ...(content !== undefined ? { content } : {}),
        ...(conflict ? { conflict: true } : {}),
    };
}
/** Lowercase kebab slug from a human title. */
export function slugifyTitle(title) {
    const slug = title
        .trim()
        .toLowerCase()
        .replace(/['"]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
    if (!slug)
        throw new Error('title produces an empty slug');
    return slug;
}
function stripKindPrefix(slug, kind) {
    const filePrefix = `${KIND_FILE_PREFIX[kind]}-`;
    const idPrefix = KIND_ID_PREFIX[kind].toLowerCase();
    let next = slug;
    if (next.startsWith(filePrefix))
        next = next.slice(filePrefix.length);
    if (next.toLowerCase().startsWith(idPrefix)) {
        next = next.slice(idPrefix.length);
    }
    return next || slug;
}
function resolveDocsPath(cwd, explicit) {
    if (explicit)
        return explicit;
    const detected = detectProject(cwd).docsPath;
    if (!detected) {
        throw new Error('No docs app found (expected docs/ or apps/docs/).');
    }
    return detected;
}
function readTemplate(docsPathAbsolute, kind) {
    const candidates = [
        join(docsPathAbsolute, 'templates', TEMPLATE_FILE[kind]),
        join(docsPathAbsolute, '..', '..', 'templates', 'default', 'docs', 'templates', TEMPLATE_FILE[kind]),
        // skill-bundled templates (skills/oh-my-doc/templates/default/docs/templates)
        join(docsPathAbsolute, '..', '..', 'skills', 'oh-my-doc', 'templates', 'default', 'docs', 'templates', TEMPLATE_FILE[kind]),
        join(fileURLToPath(new URL('../templates/default/docs/templates', import.meta.url)), TEMPLATE_FILE[kind]),
    ];
    for (const candidate of candidates) {
        if (existsSync(candidate))
            return readFileSync(candidate, 'utf8');
    }
    throw new Error(`Template for ${kind} not found. Looked under ${docsPathAbsolute}/templates.`);
}
function replaceFrontmatterField(source, field, value) {
    const pattern = new RegExp(`^(${field}:\\s*).*$`, 'm');
    if (pattern.test(source))
        return source.replace(pattern, `$1${value}`);
    return source.replace(/^---\n/, `---\n${field}: ${value}\n`);
}
function renderDocument(template, kind, id, title) {
    let body = template;
    body = replaceFrontmatterField(body, 'title', title);
    body = replaceFrontmatterField(body, 'id', id);
    body = body.replace(/<initiative>|<user outcome>|<contract>|<decision>|<implementation>/g, title);
    body = body.replace(/PRD-<initiative>/g, kind === 'prd' ? id : 'PRD-<initiative>');
    body = body.replace(/US-<story>/g, kind === 'story' ? id : 'US-<story>');
    body = body.replace(/SPEC-<contract>/g, kind === 'spec' ? id : 'SPEC-<contract>');
    body = body.replace(/PLAN-<initiative>/g, kind === 'plan' ? id : 'PLAN-<initiative>');
    body = body.replace(/ADR-NNN/g, kind === 'adr' ? id : 'ADR-NNN');
    if (kind === 'plan') {
        // Draft maintenance plans stay valid until authors promote them.
        body = replaceFrontmatterField(body, 'stage', 'draft');
        body = replaceFrontmatterField(body, 'changeType', 'maintenance');
        body = body.replace(/codeAreas:\n(?:  - .*\n)+/, 'codeAreas:\n  - packages/\n');
        body = body.replace(/^prd:.*\n/m, '');
        body = body.replace(/^specs:\n(?:  - .*\n)*/m, 'specs: []\n');
        body = body.replace(/^stories:\n(?:  - .*\n)*/m, 'stories: []\n');
    }
    if (kind === 'prd') {
        body = replaceFrontmatterField(body, 'status', 'draft');
        body = body.replace(/^stories:\n(?:  - .*\n)*/m, 'stories: []\n');
    }
    if (kind === 'spec') {
        body = replaceFrontmatterField(body, 'stage', 'draft');
    }
    if (kind === 'adr') {
        body = replaceFrontmatterField(body, 'stage', 'accepted');
    }
    return body;
}
function registerMeta(metaSource, slug) {
    const meta = JSON.parse(metaSource);
    if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) {
        throw new Error('meta.json must be a JSON object');
    }
    const record = meta;
    const pages = Array.isArray(record.pages)
        ? record.pages.filter((item) => typeof item === 'string')
        : [];
    if (pages.includes(slug)) {
        return `${JSON.stringify(meta, null, 2)}\n`;
    }
    const next = { ...record, pages: [...pages, slug] };
    return `${JSON.stringify(next, null, 2)}\n`;
}
function validateAfterCreate(contentDirectory, staged) {
    const root = mkdtempSync(join(tmpdir(), 'oh-my-docs-new-'));
    try {
        cpSync(contentDirectory, root, { recursive: true });
        const filePath = join(root, staged.relativeFile);
        mkdirSync(dirname(filePath), { recursive: true });
        writeFileSync(filePath, staged.content);
        writeFileSync(join(root, staged.metaRelative), staged.metaContent);
        return validatePlanning(root);
    }
    finally {
        rmSync(root, { recursive: true, force: true });
    }
}
/**
 * Plan creation of a planning document with deterministic id/slug and meta.json
 * registration. Does not write files — use applyFileOperations.
 */
export function planCreateDocument(options) {
    const title = options.title.trim();
    if (!title)
        throw new Error('--title is required');
    const docsPath = resolveDocsPath(options.cwd, options.docsPath);
    const docsAbsolute = join(options.cwd, docsPath);
    const contentDirectory = join(docsAbsolute, 'content/docs');
    if (!existsSync(contentDirectory)) {
        throw new Error(`content/docs not found under ${docsPath}`);
    }
    const baseSlug = stripKindPrefix(slugifyTitle(title), options.kind);
    const slug = `${KIND_FILE_PREFIX[options.kind]}-${baseSlug}`;
    const id = options.id?.trim() || `${KIND_ID_PREFIX[options.kind]}${baseSlug}`;
    if (!id.toUpperCase().startsWith(KIND_ID_PREFIX[options.kind])) {
        throw new Error(`${options.kind} id must start with ${KIND_ID_PREFIX[options.kind]}`);
    }
    const existing = collectPlanningDocuments(contentDirectory);
    if (existing.documents.some((doc) => doc.id === id)) {
        throw new Error(`id ${id} already exists`);
    }
    if (existing.documents.some((doc) => doc.slug === slug)) {
        throw new Error(`slug ${slug} already exists`);
    }
    const relativePath = join(docsPath, 'content/docs', KIND_DIR[options.kind], `${slug}.mdx`).replace(/\\/g, '/');
    const metaRelative = join(docsPath, 'content/docs', KIND_DIR[options.kind], 'meta.json').replace(/\\/g, '/');
    const template = readTemplate(docsAbsolute, options.kind);
    const content = renderDocument(template, options.kind, id, title);
    const operations = [
        op(relativePath, 'create', `create ${options.kind} ${id}`, content),
    ];
    const metaAbsolute = join(options.cwd, metaRelative);
    let metaContent;
    if (!existsSync(metaAbsolute)) {
        metaContent = `${JSON.stringify({ pages: ['index', slug] }, null, 2)}\n`;
        operations.push(op(metaRelative, 'create', 'create sibling meta.json', metaContent));
    }
    else {
        metaContent = registerMeta(readFileSync(metaAbsolute, 'utf8'), slug);
        operations.push(op(metaRelative, 'update', `register ${slug} in meta.json`, metaContent));
    }
    const validationProblems = validateAfterCreate(contentDirectory, {
        relativeFile: join(KIND_DIR[options.kind], `${slug}.mdx`).replace(/\\/g, '/'),
        content,
        metaRelative: join(KIND_DIR[options.kind], 'meta.json').replace(/\\/g, '/'),
        metaContent,
    });
    return {
        kind: options.kind,
        id,
        slug,
        relativePath,
        operations,
        validationProblems,
    };
}
