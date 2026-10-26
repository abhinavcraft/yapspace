-- YapSpace setup / missing-function repair
-- Run the whole file in a dedicated YapSpace project. Existing rows are preserved.
-- Replaces only YapSpace-owned policies/functions; incompatible schemas fail.

-- YapSpace: private, text-only, two-person conversations.
-- Narrow SECURITY DEFINER functions are intentional: direct writes are revoked.
-- Every callable write binds the actor to auth.uid(), checks membership, uses a
-- fixed empty search_path and schema-qualified objects. PUBLIC execute is revoked.
begin;
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9][a-z0-9_.]{2,23}$' and handle not in ('admin','administrator','support','system','yapspace')),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  created_at timestamptz not null default now()
);
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_low_id uuid not null references public.profiles(id) on delete restrict,
  user_high_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  next_seq bigint not null default 1 check (next_seq > 0),
  check (user_low_id < user_high_id), unique (user_low_id,user_high_id)
);
create index if not exists conversations_low_activity on public.conversations(user_low_id,last_message_at desc);
create index if not exists conversations_high_activity on public.conversations(user_high_id,last_message_at desc);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete restrict,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  client_message_id uuid not null,
  seq bigint not null check (seq > 0),
  body text not null check (char_length(body) between 1 and 4000 and body ~ '[^[:space:]]'),
  created_at timestamptz not null default clock_timestamp(),
  unique (conversation_id,seq), unique (sender_id,client_message_id)
);
create index if not exists messages_page on public.messages(conversation_id,seq desc);
create index if not exists messages_sender_rate on public.messages(sender_id,created_at desc);
create table if not exists public.conversation_reads (
  conversation_id uuid not null references public.conversations(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  last_read_seq bigint not null default 0 check (last_read_seq >= 0),
  updated_at timestamptz not null default now(), primary key(conversation_id,user_id)
);
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.conversation_reads enable row level security;
revoke all on public.profiles,public.conversations,public.messages,public.conversation_reads from anon,authenticated;
grant select on public.profiles,public.conversations,public.messages,public.conversation_reads to authenticated;
drop policy if exists conversations_member_select on public.conversations;
create policy conversations_member_select on public.conversations for select to authenticated
  using ((select auth.uid()) in (user_low_id,user_high_id));
drop policy if exists profiles_self_or_peer on public.profiles;
create policy profiles_self_or_peer on public.profiles for select to authenticated
  using (id=(select auth.uid()) or exists(select 1 from public.conversations c where profiles.id in(c.user_low_id,c.user_high_id) and (select auth.uid()) in(c.user_low_id,c.user_high_id)));
drop policy if exists messages_member_select on public.messages;
create policy messages_member_select on public.messages for select to authenticated
  using (exists(select 1 from public.conversations c where c.id=messages.conversation_id and (select auth.uid()) in(c.user_low_id,c.user_high_id)));
drop policy if exists reads_self_select on public.conversation_reads;
create policy reads_self_select on public.conversation_reads for select to authenticated
  using (user_id=(select auth.uid()) and exists(select 1 from public.conversations c where c.id=conversation_reads.conversation_id and (select auth.uid()) in(c.user_low_id,c.user_high_id)));

create or replace function public.complete_profile(p_handle text,p_display_name text) returns public.profiles
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result public.profiles;
begin
  if actor is null then raise exception 'Sign in first' using errcode='42501'; end if;
  if p_handle is null or p_display_name is null then raise exception 'Name and handle are required' using errcode='22023'; end if;
  insert into public.profiles(id,handle,display_name) values(actor,lower(btrim(p_handle)),btrim(p_display_name))
    on conflict(id) do nothing;
  select * into result from public.profiles where id=actor;
  return result;
end; $$;

create or replace function public.search_profiles(p_query text) returns table(id uuid,handle text,display_name text)
language plpgsql security definer set search_path='' as $$
declare term text:=lower(btrim(p_query));
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode='42501'; end if;
  if term is null or char_length(term)<2 or char_length(term)>60 then return; end if;
  -- Literal prefix comparison: % and _ do not become wildcard enumeration.
  return query select p.id,p.handle,p.display_name from public.profiles p
    where p.id<>auth.uid() and (left(p.handle,char_length(term))=term or left(lower(p.display_name),char_length(term))=term)
    order by p.handle limit 20;
end; $$;

create or replace function public.get_or_create_direct_conversation(p_recipient_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); low_id uuid; high_id uuid; result uuid;
begin
  if actor is null then raise exception 'Sign in first' using errcode='42501'; end if;
  if p_recipient_id is null or actor=p_recipient_id then raise exception 'Choose another person' using errcode='22023'; end if;
  if not exists(select 1 from public.profiles where id=actor) or not exists(select 1 from public.profiles where id=p_recipient_id) then raise exception 'Profile unavailable' using errcode='22023'; end if;
  low_id:=least(actor,p_recipient_id); high_id:=greatest(actor,p_recipient_id);
  perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
  select id into result from public.conversations where user_low_id=low_id and user_high_id=high_id;
  if result is not null then return result; end if;
  if (select count(*) from public.conversations where actor in(user_low_id,user_high_id) and created_at>clock_timestamp()-interval '1 minute')>=20 then raise exception 'Please wait before starting another conversation' using errcode='P0001'; end if;
  insert into public.conversations(user_low_id,user_high_id) values(low_id,high_id)
    on conflict(user_low_id,user_high_id) do nothing returning id into result;
  if result is null then select id into result from public.conversations where user_low_id=low_id and user_high_id=high_id; end if;
  return result;
end; $$;

create or replace function public.send_message(p_conversation_id uuid,p_client_message_id uuid,p_body text) returns public.messages
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); chat public.conversations; saved public.messages;
begin
  if actor is null then raise exception 'Sign in first' using errcode='42501'; end if;
  if p_client_message_id is null or p_body is null or char_length(p_body) not between 1 and 4000 or p_body !~ '[^[:space:]]' then raise exception 'Message must contain 1–4,000 characters' using errcode='22023'; end if;
  -- Serialize an actor across chats so rate limits and global idempotency agree.
  perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
  select * into chat from public.conversations where id=p_conversation_id and actor in(user_low_id,user_high_id) for update;
  if not found then raise exception 'Conversation unavailable' using errcode='42501'; end if;
  select * into saved from public.messages where sender_id=actor and client_message_id=p_client_message_id;
  if found then
    if saved.conversation_id<>p_conversation_id or saved.body<>p_body then raise exception 'Retry key conflicts with the original message' using errcode='22023'; end if;
    return saved;
  end if;
  if (select count(*) from public.messages where sender_id=actor and created_at>clock_timestamp()-interval '1 minute')>=60 then raise exception 'Slow down a little. Try again in a minute.' using errcode='P0001'; end if;
  insert into public.messages(conversation_id,sender_id,client_message_id,seq,body)
    values(p_conversation_id,actor,p_client_message_id,chat.next_seq,p_body) returning * into saved;
  update public.conversations set next_seq=next_seq+1,last_message_at=saved.created_at where id=chat.id;
  return saved;
end; $$;

create or replace function public.advance_read_cursor(p_conversation_id uuid,p_target_seq bigint) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); maximum bigint;
begin
  if actor is null then raise exception 'Sign in first' using errcode='42501'; end if;
  select next_seq-1 into maximum from public.conversations where id=p_conversation_id and actor in(user_low_id,user_high_id);
  if not found then raise exception 'Conversation unavailable' using errcode='42501'; end if;
  if p_target_seq is null or p_target_seq<0 then raise exception 'Invalid read position' using errcode='22023'; end if;
  insert into public.conversation_reads(conversation_id,user_id,last_read_seq) values(p_conversation_id,actor,least(p_target_seq,maximum))
  on conflict(conversation_id,user_id) do update set last_read_seq=greatest(public.conversation_reads.last_read_seq,excluded.last_read_seq),updated_at=clock_timestamp();
end; $$;

create or replace function public.list_conversations() returns table(id uuid,peer_id uuid,handle text,display_name text,last_body text,last_message_at timestamptz,unread_count bigint,last_seq bigint)
language sql stable security invoker set search_path='' as $$
  select c.id,p.id,p.handle,p.display_name,m.body,c.last_message_at,
    (select count(*) from public.messages unread where unread.conversation_id=c.id and unread.sender_id<>auth.uid() and unread.seq>coalesce(r.last_read_seq,0)),c.next_seq-1
  from public.conversations c
  join public.profiles p on p.id=case when c.user_low_id=auth.uid() then c.user_high_id else c.user_low_id end
  left join public.messages m on m.conversation_id=c.id and m.seq=c.next_seq-1
  left join public.conversation_reads r on r.conversation_id=c.id and r.user_id=auth.uid()
  where auth.uid() in(c.user_low_id,c.user_high_id)
  order by c.last_message_at desc nulls last,c.created_at desc;
$$;

-- Trigger publishes identifiers only; clients re-fetch authorized canonical rows.
create or replace function public.notify_message() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform realtime.send(jsonb_build_object('conversation_id',new.conversation_id,'message_id',new.id,'seq',new.seq),'message','conversation:'||new.conversation_id::text,true);
  return new;
end; $$;
drop trigger if exists message_notification on public.messages;
create trigger message_notification after insert on public.messages for each row execute function public.notify_message();
-- realtime.messages already has RLS managed by Supabase. Do not alter its owner/RLS.
drop policy if exists yapspace_private_receive on realtime.messages;
create policy yapspace_private_receive on realtime.messages for select to authenticated using (
  extension='broadcast' and exists(select 1 from public.conversations c where 'conversation:'||c.id::text=(select realtime.topic()) and (select auth.uid()) in(c.user_low_id,c.user_high_id))
);

revoke all on function public.complete_profile(text,text),public.search_profiles(text),public.get_or_create_direct_conversation(uuid),public.send_message(uuid,uuid,text),public.advance_read_cursor(uuid,bigint),public.list_conversations(),public.notify_message() from public,anon,authenticated;
grant execute on function public.complete_profile(text,text),public.search_profiles(text),public.get_or_create_direct_conversation(uuid),public.send_message(uuid,uuid,text),public.advance_read_cursor(uuid,bigint),public.list_conversations() to authenticated;
commit;

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

notify pgrst,'reload schema';
