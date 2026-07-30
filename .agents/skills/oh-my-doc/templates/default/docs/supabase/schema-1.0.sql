-- Oh My Docs handbook schema v1.0 (BYO Supabase SSOT)
-- Applied by host Supabase CLI/MCP from the provision manifest. Idempotent.

create table if not exists public.omd_documents (
  id text primary key,
  kind text not null,
  ticker text,
  path text not null unique,
  frontmatter jsonb not null default '{}'::jsonb,
  body_mdx text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.omd_catalog_meta (
  catalog_key text primary key,
  pages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.omd_documents enable row level security;
alter table public.omd_catalog_meta enable row level security;

drop policy if exists omd_documents_select_authenticated on public.omd_documents;
create policy omd_documents_select_authenticated
  on public.omd_documents
  for select
  to authenticated
  using (true);

drop policy if exists omd_documents_write_authenticated on public.omd_documents;
create policy omd_documents_write_authenticated
  on public.omd_documents
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists omd_documents_select_anon on public.omd_documents;
create policy omd_documents_select_anon
  on public.omd_documents
  for select
  to anon
  using (true);

drop policy if exists omd_catalog_meta_select_authenticated on public.omd_catalog_meta;
create policy omd_catalog_meta_select_authenticated
  on public.omd_catalog_meta
  for select
  to authenticated
  using (true);

drop policy if exists omd_catalog_meta_write_authenticated on public.omd_catalog_meta;
create policy omd_catalog_meta_write_authenticated
  on public.omd_catalog_meta
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists omd_catalog_meta_select_anon on public.omd_catalog_meta;
create policy omd_catalog_meta_select_anon
  on public.omd_catalog_meta
  for select
  to anon
  using (true);

grant select on public.omd_documents to anon, authenticated;
grant insert, update, delete on public.omd_documents to authenticated;
grant select on public.omd_catalog_meta to anon, authenticated;
grant insert, update, delete on public.omd_catalog_meta to authenticated;
