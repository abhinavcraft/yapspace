begin;
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  low_id uuid generated always as (least(requester_id,recipient_id)) stored,
  high_id uuid generated always as (greatest(requester_id,recipient_id)) stored,
  status text not null default 'pending' check(status in ('pending','accepted','declined','cancelled','removed')),
  requested_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check(requester_id<>recipient_id), unique(low_id,high_id)
);
create index if not exists friendships_requester_status on public.friendships(requester_id,status,requested_at desc);
create index if not exists friendships_recipient_status on public.friendships(recipient_id,status);
alter table public.friendships enable row level security;
revoke all on public.friendships from anon,authenticated;
grant select on public.friendships to authenticated;
drop policy if exists friendships_self_select on public.friendships;
create policy friendships_self_select on public.friendships for select to authenticated
using((select auth.uid()) in(requester_id,recipient_id));

create or replace function public.send_friend_request(p_recipient_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); old public.friendships;
begin
  if actor is null then raise exception 'Sign in first' using errcode='42501'; end if;
  if p_recipient_id is null or p_recipient_id=actor then raise exception 'Choose another person' using errcode='22023'; end if;
  if not exists(select 1 from public.profiles where id=actor) or not exists(select 1 from public.profiles where id=p_recipient_id) then raise exception 'Profile unavailable' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,2));
  perform pg_advisory_xact_lock(hashtextextended(least(actor,p_recipient_id)::text||':'||greatest(actor,p_recipient_id)::text,3));
  select * into old from public.friendships where low_id=least(actor,p_recipient_id) and high_id=greatest(actor,p_recipient_id) for update;
  if old.status in('pending','accepted') then return; end if;
  if old.updated_at>clock_timestamp()-interval '1 minute' then raise exception 'Please wait a minute before requesting again' using errcode='P0001'; end if;
  if (select count(*) from public.friendships where requester_id=actor and requested_at>clock_timestamp()-interval '1 minute')>=10
    or (select count(*) from public.friendships where requester_id=actor and status='pending')>=100 then raise exception 'Too many requests. Please wait before adding more friends.' using errcode='P0001'; end if;
  insert into public.friendships(requester_id,recipient_id) values(actor,p_recipient_id)
  on conflict(low_id,high_id) do update set requester_id=actor,recipient_id=p_recipient_id,status='pending',requested_at=clock_timestamp(),updated_at=clock_timestamp();
end; $$;

create or replace function public.respond_friend_request(p_peer_id uuid,p_action text) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); item public.friendships; target text;
begin
  if actor is null then raise exception 'Sign in first' using errcode='42501'; end if;
  select * into item from public.friendships where low_id=least(actor,p_peer_id) and high_id=greatest(actor,p_peer_id) and actor in(requester_id,recipient_id) for update;
  if not found then raise exception 'Request unavailable' using errcode='42501'; end if;
  if p_action='accept' and item.status='accepted' then return; end if;
  if p_action in('accept','decline') and item.status='pending' and item.recipient_id=actor then target:=case when p_action='accept' then 'accepted' else 'declined' end;
  elsif p_action='cancel' and item.status='pending' and item.requester_id=actor then target:='cancelled';
  elsif p_action='remove' and item.status='accepted' then target:='removed';
  else raise exception 'This request cannot be changed that way' using errcode='42501'; end if;
  update public.friendships set status=target,updated_at=clock_timestamp() where id=item.id;
end; $$;

create or replace function public.list_relationships() returns table(id uuid,peer_id uuid,requester_id uuid,recipient_id uuid,status text,display_name text,handle text)
language sql stable security definer set search_path='' as $$
  select f.id,p.id,f.requester_id,f.recipient_id,f.status,p.display_name,p.handle
  from public.friendships f join public.profiles p on p.id=case when f.requester_id=auth.uid() then f.recipient_id else f.requester_id end
  where auth.uid() in(f.requester_id,f.recipient_id) and f.status in('pending','accepted') order by f.updated_at desc limit 500;
$$;

create or replace function public.notify_friendship() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  begin
    perform realtime.send('{}'::jsonb,'friends','social:'||new.requester_id::text,true);
    perform realtime.send('{}'::jsonb,'friends','social:'||new.recipient_id::text,true);
  exception when others then null; end;
  return new;
end; $$;
drop trigger if exists friendship_notification on public.friendships;
create trigger friendship_notification after insert or update on public.friendships for each row execute function public.notify_friendship();

drop policy if exists yapspace_social_receive on realtime.messages;
create policy yapspace_social_receive on realtime.messages for select to authenticated using(
  extension='broadcast' and (select realtime.topic())='social:'||(select auth.uid())::text
);
drop policy if exists yapspace_presence_receive on realtime.messages;
create policy yapspace_presence_receive on realtime.messages for select to authenticated using(extension='presence' and (
  (select realtime.topic())='presence:'||(select auth.uid())::text
  or exists(select 1 from public.friendships f where f.status='accepted' and (select auth.uid()) in(f.requester_id,f.recipient_id)
    and (select realtime.topic())='presence:'||(case when f.requester_id=(select auth.uid()) then f.recipient_id else f.requester_id end)::text)
  or exists(select 1 from public.conversations c where (select auth.uid()) in(c.user_low_id,c.user_high_id)
    and (select realtime.topic())='presence:'||(case when c.user_low_id=(select auth.uid()) then c.user_high_id else c.user_low_id end)::text)
));
drop policy if exists yapspace_presence_publish on realtime.messages;
create policy yapspace_presence_publish on realtime.messages for insert to authenticated with check(
  extension='presence' and (select realtime.topic())='presence:'||(select auth.uid())::text
  and exists(select 1 from public.profiles where id=(select auth.uid()))
);
drop policy if exists yapspace_typing_receive on realtime.messages;
create policy yapspace_typing_receive on realtime.messages for select to authenticated using(extension='broadcast' and exists(
  select 1 from public.conversations c where (select auth.uid()) in(c.user_low_id,c.user_high_id)
    and ((select realtime.topic())='typing:'||c.id::text||':'||c.user_low_id::text or (select realtime.topic())='typing:'||c.id::text||':'||c.user_high_id::text)
));
drop policy if exists yapspace_typing_publish on realtime.messages;
create policy yapspace_typing_publish on realtime.messages for insert to authenticated with check(extension='broadcast' and exists(
  select 1 from public.conversations c where (select auth.uid()) in(c.user_low_id,c.user_high_id)
    and (select realtime.topic())='typing:'||c.id::text||':'||(select auth.uid())::text
));
grant insert on realtime.messages to authenticated;
revoke all on function public.send_friend_request(uuid),public.respond_friend_request(uuid,text),public.list_relationships(),public.notify_friendship() from public,anon,authenticated;
grant execute on function public.send_friend_request(uuid),public.respond_friend_request(uuid,text),public.list_relationships() to authenticated;
notify pgrst,'reload schema';
commit;
