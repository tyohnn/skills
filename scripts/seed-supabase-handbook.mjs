#!/usr/bin/env node
/**
 * One-shot helper: upsert local docs/content/docs/*.mdx into omd_documents.
 * SSOT remains Supabase — this is for initial adopt / recovery, not day-to-day edits.
 *
 * Usage:
 *   node scripts/seed-supabase-handbook.mjs > /tmp/seed.sql
 *   # then apply via Supabase MCP execute_sql / CLI
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(process.cwd(), 'docs/content/docs');
const outPath = process.argv[2] || null;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.mdx')) out.push(p);
  }
  return out;
}

function parseMdx(raw) {
  if (!raw.startsWith('---')) return { frontmatter: {}, body: raw };
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return { frontmatter: {}, body: raw };
  const yaml = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).replace(/^\n/, '');
  const frontmatter = {};
  for (const line of yaml.split('\n')) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    } else if (v.startsWith('[') || v.startsWith('{')) {
      try {
        v = JSON.parse(v);
      } catch {
        /* keep string */
      }
    } else if (v === 'true' || v === 'false') {
      v = v === 'true';
    }
    frontmatter[m[1]] = v;
  }
  return { frontmatter, body };
}

function sqlString(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

const visionBody = `이 레포는 스킬의 구현·조합·의존성 선언을 관리하는 모노레포다.
독립 제품·런타임·UI로 커진 구성요소만 별도 레포로 분리하고, 그 외는 \`skills/<slug>\` flat 구조로 모은다.

## 한 줄 결론

> **tyohnn/skills**는 스킬의 구현·조합·의존성 선언을 관리하는 모노레포다.
> 상위 workflow는 라우팅과 완료 조건만 소유하고, 하위 능력은 dependency graph로 조합한다.

## 확정된 결정

1. **oh-my-docs는 이 레포에 두지 않는다.** 별도 레포에 두고 외부 스킬 의존성으로 선언한다.
2. **3d-game-dev는 초기 범위에서 제외한다.**
3. **skill.yaml은 우리 레포용 확장 manifest다.** skills.sh가 읽는 표준 설치 단위는 여전히 SKILL.md frontmatter다.

## Handbook SSOT

Handbook content SSOT는 공유 Supabase 프로젝트 **oh-my-docs**의 handbook \`skills\`(\`omd_h_skills\`)다.
로컬 \`docs/content/docs\`는 캐시/스캐폴드이며 권위 있는 본문이 아니다.

Notion에 있던 방향 문서(\`tyohnn/skills 방향\`)를 Vision 시드로 옮겼다.
`;

const files = walk(root);
const rows = [];

for (const file of files) {
  const rel = relative(root, file).replace(/\\/g, '/');
  const pathNoExt = rel.endsWith('.mdx') ? rel.slice(0, -4) : rel;
  let { frontmatter, body } = parseMdx(readFileSync(file, 'utf8'));

  if (pathNoExt === 'vision') {
    frontmatter = {
      ...frontmatter,
      title: frontmatter.title || 'Vision',
      description: 'Product intent and long-term direction for tyohnn/skills.',
      summary: 'tyohnn/skills is a skill monorepo; handbook SSOT is Supabase.',
    };
    body = visionBody;
  }

  const id = String(frontmatter.id || pathNoExt.replaceAll('/', '__'));
  const kind = String(frontmatter.type || (pathNoExt.includes('/') ? 'page' : 'overview'));
  const ticker = frontmatter.ticker ? String(frontmatter.ticker) : null;
  rows.push({ id, kind, ticker, path: pathNoExt, frontmatter, body });
}

const values = rows
  .map((r) => {
    const fm = sqlString(JSON.stringify(r.frontmatter));
    const body = sqlString(r.body);
    const ticker = r.ticker == null ? 'null' : sqlString(r.ticker);
    return `(${sqlString(r.id)}, ${sqlString(r.kind)}, ${ticker}, ${sqlString(r.path)}, ${fm}::jsonb, ${body})`;
  })
  .join(',\n');

const sql = `insert into public.omd_documents (id, kind, ticker, path, frontmatter, body_mdx)
values
${values}
on conflict (id) do update set
  kind = excluded.kind,
  ticker = excluded.ticker,
  path = excluded.path,
  frontmatter = excluded.frontmatter,
  body_mdx = excluded.body_mdx,
  updated_at = now();
`;

if (outPath) {
  writeFileSync(outPath, sql);
  console.error(`wrote ${rows.length} rows to ${outPath}`);
} else {
  process.stdout.write(sql);
}
for (const r of rows) console.error(`- ${r.path} (${r.id})`);
