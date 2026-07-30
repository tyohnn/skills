-- Oh My Docs handbook schema v1.1
-- Shared BYO project: registry in public + one Postgres schema per handbook.
-- Idempotent.

create table if not exists public.omd_handbooks (
  handbook_id text primary key,
  pg_schema text not null unique,
  schema_version text not null default '1.1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint omd_handbooks_pg_schema_format
    check (pg_schema ~ '^omd_h_[a-z0-9_]+$')
);

alter table public.omd_handbooks enable row level security;

drop policy if exists omd_handbooks_select_authenticated on public.omd_handbooks;
create policy omd_handbooks_select_authenticated
  on public.omd_handbooks for select to authenticated using (true);

drop policy if exists omd_handbooks_write_authenticated on public.omd_handbooks;
create policy omd_handbooks_write_authenticated
  on public.omd_handbooks for all to authenticated using (true) with check (true);

drop policy if exists omd_handbooks_select_anon on public.omd_handbooks;
create policy omd_handbooks_select_anon
  on public.omd_handbooks for select to anon using (true);

grant select on public.omd_handbooks to anon, authenticated;
grant insert, update, delete on public.omd_handbooks to authenticated;

-- Helper: create a handbook schema + tables + RLS (call via migrate script).
-- Example: select public.omd_ensure_handbook('oh-my-docs', '1.1');

create or replace function public.omd_ensure_handbook(
  p_handbook_id text,
  p_schema_version text default '1.1'
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schema text;
  v_sql text;
begin
  if p_handbook_id is null or p_handbook_id !~ '^[a-z][a-z0-9-]{1,62}$' then
    raise exception 'handbook_id_invalid: %', p_handbook_id;
  end if;
  if p_handbook_id in ('public', 'auth', 'storage', 'extensions', 'graphql', 'realtime', 'vault') then
    raise exception 'handbook_id_invalid reserved: %', p_handbook_id;
  end if;

  v_schema := 'omd_h_' || replace(p_handbook_id, '-', '_');

  insert into public.omd_handbooks (handbook_id, pg_schema, schema_version)
  values (p_handbook_id, v_schema, p_schema_version)
  on conflict (handbook_id) do update
    set schema_version = excluded.schema_version,
        updated_at = now()
  returning pg_schema into v_schema;

  execute format('create schema if not exists %I', v_schema);

  execute format($f$
    create table if not exists %I.omd_documents (
      id text primary key,
      kind text not null,
      ticker text,
      path text not null unique,
      frontmatter jsonb not null default '{}'::jsonb,
      body_mdx text not null default '',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  $f$, v_schema);

  execute format($f$
    create table if not exists %I.omd_catalog_meta (
      catalog_key text primary key,
      pages jsonb not null default '[]'::jsonb,
      updated_at timestamptz not null default now()
    )
  $f$, v_schema);

  execute format('alter table %I.omd_documents enable row level security', v_schema);
  execute format('alter table %I.omd_catalog_meta enable row level security', v_schema);

  execute format('drop policy if exists omd_documents_select_authenticated on %I.omd_documents', v_schema);
  execute format(
    'create policy omd_documents_select_authenticated on %I.omd_documents for select to authenticated using (true)',
    v_schema
  );
  execute format('drop policy if exists omd_documents_write_authenticated on %I.omd_documents', v_schema);
  execute format(
    'create policy omd_documents_write_authenticated on %I.omd_documents for all to authenticated using (true) with check (true)',
    v_schema
  );
  execute format('drop policy if exists omd_documents_select_anon on %I.omd_documents', v_schema);
  execute format(
    'create policy omd_documents_select_anon on %I.omd_documents for select to anon using (true)',
    v_schema
  );

  execute format('drop policy if exists omd_catalog_meta_select_authenticated on %I.omd_catalog_meta', v_schema);
  execute format(
    'create policy omd_catalog_meta_select_authenticated on %I.omd_catalog_meta for select to authenticated using (true)',
    v_schema
  );
  execute format('drop policy if exists omd_catalog_meta_write_authenticated on %I.omd_catalog_meta', v_schema);
  execute format(
    'create policy omd_catalog_meta_write_authenticated on %I.omd_catalog_meta for all to authenticated using (true) with check (true)',
    v_schema
  );
  execute format('drop policy if exists omd_catalog_meta_select_anon on %I.omd_catalog_meta', v_schema);
  execute format(
    'create policy omd_catalog_meta_select_anon on %I.omd_catalog_meta for select to anon using (true)',
    v_schema
  );

  execute format('grant usage on schema %I to anon, authenticated', v_schema);
  execute format('grant select on all tables in schema %I to anon, authenticated', v_schema);
  execute format('grant insert, update, delete on all tables in schema %I to authenticated', v_schema);
  execute format(
    'alter default privileges in schema %I grant select on tables to anon, authenticated',
    v_schema
  );
  execute format(
    'alter default privileges in schema %I grant insert, update, delete on tables to authenticated',
    v_schema
  );

  return v_schema;
end;
$$;

revoke all on function public.omd_ensure_handbook(text, text) from public;
grant execute on function public.omd_ensure_handbook(text, text) to authenticated;
