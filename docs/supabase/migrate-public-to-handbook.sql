-- Move legacy public.omd_* rows into a dedicated handbook schema, then clear public.
-- Params via temp settings (defaults shown):
--   select set_config('omd.migrate_handbook_id', 'oh-my-docs', false);

do $$
declare
  v_id text := coalesce(nullif(current_setting('omd.migrate_handbook_id', true), ''), 'oh-my-docs');
  v_schema text;
  v_docs int;
  v_cats int;
begin
  v_schema := public.omd_ensure_handbook(v_id, '1.1');

  execute format(
    'insert into %I.omd_documents (id, kind, ticker, path, frontmatter, body_mdx, created_at, updated_at)
     select id, kind, ticker, path, frontmatter, body_mdx, created_at, updated_at
     from public.omd_documents
     on conflict (id) do update set
       kind = excluded.kind,
       ticker = excluded.ticker,
       path = excluded.path,
       frontmatter = excluded.frontmatter,
       body_mdx = excluded.body_mdx,
       updated_at = excluded.updated_at',
    v_schema
  );

  execute format(
    'insert into %I.omd_catalog_meta (catalog_key, pages, updated_at)
     select catalog_key, pages, updated_at
     from public.omd_catalog_meta
     on conflict (catalog_key) do update set
       pages = excluded.pages,
       updated_at = excluded.updated_at',
    v_schema
  );

  execute format('select count(*) from %I.omd_documents', v_schema) into v_docs;
  execute format('select count(*) from %I.omd_catalog_meta', v_schema) into v_cats;

  if v_docs > 0 then
    delete from public.omd_documents;
  end if;
  if v_cats > 0 then
    delete from public.omd_catalog_meta;
  end if;

  raise notice 'migrated handbook_id=% schema=% docs=% catalogs=%', v_id, v_schema, v_docs, v_cats;
end $$;
