begin;
alter table public.profiles add column if not exists bio text not null default '' check (char_length(bio)<=190);
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
-- This function is only a server-side write primitive. The Edge Function must
-- authenticate AND verify the password on each request before invoking it.
create or replace function public.update_profile_verified(p_user_id uuid,p_handle text,p_display_name text,p_bio text) returns public.profiles
language plpgsql security invoker set search_path='' as $$
declare result public.profiles;
begin
  if p_user_id is null or p_handle is null or p_display_name is null or p_bio is null then raise exception 'Invalid profile' using errcode='22023'; end if;
  update public.profiles set handle=lower(btrim(p_handle)),display_name=btrim(p_display_name),bio=p_bio,updated_at=clock_timestamp() where id=p_user_id returning * into result;
  if not found then raise exception 'Profile unavailable' using errcode='22023'; end if;
  return result;
end; $$;
revoke all on function public.update_profile_verified(uuid,text,text,text) from public,anon,authenticated;
grant usage on schema public to service_role;
grant select on public.profiles to service_role;
grant update(handle,display_name,bio,updated_at) on public.profiles to service_role;
grant execute on function public.update_profile_verified(uuid,text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
