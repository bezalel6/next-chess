-- Reset script to clean up all data and tables
-- Run this when you want to start fresh

-- Drop all tables
DROP TABLE IF EXISTS public.moves;
DROP TABLE IF EXISTS public.games;

-- Drop all functions
DROP FUNCTION IF EXISTS public.generate_short_id(integer);
DROP FUNCTION IF EXISTS public.update_updated_at_column();

-- Now you can run the schema.sql to recreate everything 

do $$ declare
  rec record;
begin
  -- extensions
  for rec in
    select *
    from pg_extension p
    where p.extname not in ('pg_graphql', 'pg_net', 'pg_stat_statements', 'pgcrypto', 'pgjwt', 'pgsodium', 'plpgsql', 'supabase_vault', 'uuid-ossp')
  loop
    execute format('drop extension if exists %I cascade', rec.extname);
  end loop;

  -- functions
  for rec in
    select *
    from pg_proc p
    where p.pronamespace::regnamespace::name = 'public'
  loop
    -- supports aggregate, function, and procedure
    execute format('drop routine if exists %I.%I(%s) cascade', rec.pronamespace::regnamespace::name, rec.proname, pg_catalog.pg_get_function_identity_arguments(rec.oid));
  end loop;

  -- views (necessary for views referencing objects in Supabase-managed schemas)
  for rec in
    select *
    from pg_class c
    where
      c.relnamespace::regnamespace::name = 'public'
      and c.relkind = 'v'
  loop
    execute format('drop view if exists %I.%I cascade', rec.relnamespace::regnamespace::name, c.relname);
  end loop;

  -- materialized views (necessary for materialized views referencing objects in Supabase-managed schemas)
  for rec in
    select *
    from pg_class c
    where
      c.relnamespace::regnamespace::name = 'public'
      and c.relkind = 'm'
  loop
    execute format('drop materialized view if exists %I.%I cascade', rec.relnamespace::regnamespace::name, c.relname);
  end loop;

  -- tables (cascade to views)
  for rec in
    select *
    from pg_class c
    where
      c.relnamespace::regnamespace::name = 'public'
      and c.relkind not in ('c', 'S', 'v', 'm')
    order by c.relkind desc
  loop
    -- supports all table like relations, except views, complex types, and sequences
    execute format('drop table if exists %I.%I cascade', rec.relnamespace::regnamespace::name, c.relname);
  end loop;

  -- Only truncate tables in certain schemas that the current user has access to
  -- Skip auth.refresh_tokens and other sensitive Supabase-managed tables
  for rec in
    select *
    from pg_class c
    where
      c.relnamespace::regnamespace::name = 'public' 
      and c.relkind = 'r'
  loop
    execute format('truncate %I.%I restart identity cascade', rec.relnamespace::regnamespace::name, c.relname);
  end loop;

  -- sequences - Only modify sequences in the public schema
  for rec in
    select *
    from pg_class c
    where
      c.relnamespace::regnamespace::name = 'public'
      and c.relkind = 'S'
  loop
    execute format('drop sequence if exists %I.%I cascade', rec.relnamespace::regnamespace::name, c.relname);
  end loop;

  -- types
  for rec in
    select *
    from pg_type t
    where
      t.typnamespace::regnamespace::name = 'public'
      and typtype != 'b'
  loop
    execute format('drop type if exists %I.%I cascade', rec.typnamespace::regnamespace::name, t.typname);
  end loop;

  -- Only drop policies for public schema tables
  for rec in
    select *
    from pg_policies p
    where p.schemaname = 'public'
  loop
    execute format('drop policy if exists %I on %I.%I cascade', rec.policyname, rec.schemaname, rec.tablename);
  end loop;

  -- Skip existing supabase publications
  for rec in
    select *
    from pg_publication p
    where
      p.pubname not like 'supabase_realtime%' and 
      p.pubname not like 'realtime_messages%' and
      p.pubname != 'supabase_realtime'
  loop
    execute format('drop publication if exists %I', rec.pubname);
  end loop;
end $$; 