begin;
create table if not exists public.profile_verification_limits(
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null default clock_timestamp(),
  attempts integer not null default 1 check(attempts>0)
);
alter table public.profile_verification_limits enable row level security;
revoke all on public.profile_verification_limits from public,anon,authenticated;
grant select,insert,update on public.profile_verification_limits to service_role;
create or replace function public.consume_profile_verification(p_user_id uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare total integer;
begin
  if p_user_id is null then raise exception 'Identity required' using errcode='22023'; end if;
  insert into public.profile_verification_limits(user_id) values(p_user_id)
  on conflict(user_id) do update set
    attempts=case when public.profile_verification_limits.window_start<=clock_timestamp()-interval '5 minutes' then 1 else least(public.profile_verification_limits.attempts+1,1000000) end,
    window_start=case when public.profile_verification_limits.window_start<=clock_timestamp()-interval '5 minutes' then clock_timestamp() else public.profile_verification_limits.window_start end
  returning attempts into total;
  return total<=5;
end; $$;
revoke all on function public.consume_profile_verification(uuid) from public,anon,authenticated;
grant execute on function public.consume_profile_verification(uuid) to service_role;
create index if not exists reads_by_user on public.conversation_reads(user_id);

-- Database storage stays available if notification transport fails. Polling and
-- reconnect catch-up repair missed notifications from the canonical messages.
create or replace function public.notify_message() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  begin
    perform realtime.send(jsonb_build_object('conversation_id',new.conversation_id,'message_id',new.id,'seq',new.seq),'message','conversation:'||new.conversation_id::text,true);
  exception when others then
    raise warning 'YapSpace notification unavailable; database catch-up required';
  end;
  return new;
end; $$;
revoke all on function public.notify_message() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
