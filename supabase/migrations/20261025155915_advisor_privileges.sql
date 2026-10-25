begin;
-- Supabase's project-level DDL event trigger is not a browser API. Preserve the
-- trigger and its owner, while removing unnecessary client execution grants.
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end; $$;
notify pgrst,'reload schema';
commit;
