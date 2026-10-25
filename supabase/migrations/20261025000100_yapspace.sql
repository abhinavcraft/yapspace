-- YapSpace: private, text-only, two-person conversations.
-- Narrow SECURITY DEFINER functions are intentional: direct writes are revoked.
-- Every callable write binds the actor to auth.uid(), checks membership, uses a
-- fixed empty search_path and schema-qualified objects. PUBLIC execute is revoked.
begin;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9][a-z0-9_.]{2,23}$' and handle not in ('admin','administrator','support','system','yapspace')),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  created_at timestamptz not null default now()
);
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_low_id uuid not null references public.profiles(id) on delete restrict,
  user_high_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  next_seq bigint not null default 1 check (next_seq > 0),
  check (user_low_id < user_high_id), unique (user_low_id,user_high_id)
);
create index conversations_low_activity on public.conversations(user_low_id,last_message_at desc);
create index conversations_high_activity on public.conversations(user_high_id,last_message_at desc);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete restrict,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  client_message_id uuid not null,
  seq bigint not null check (seq > 0),
  body text not null check (char_length(body) between 1 and 4000 and body ~ '[^[:space:]]'),
  created_at timestamptz not null default clock_timestamp(),
  unique (conversation_id,seq), unique (sender_id,client_message_id)
);
create index messages_page on public.messages(conversation_id,seq desc);
create index messages_sender_rate on public.messages(sender_id,created_at desc);
create table public.conversation_reads (
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
create policy conversations_member_select on public.conversations for select to authenticated
  using ((select auth.uid()) in (user_low_id,user_high_id));
create policy profiles_self_or_peer on public.profiles for select to authenticated
  using (id=(select auth.uid()) or exists(select 1 from public.conversations c where profiles.id in(c.user_low_id,c.user_high_id) and (select auth.uid()) in(c.user_low_id,c.user_high_id)));
create policy messages_member_select on public.messages for select to authenticated
  using (exists(select 1 from public.conversations c where c.id=messages.conversation_id and (select auth.uid()) in(c.user_low_id,c.user_high_id)));
create policy reads_self_select on public.conversation_reads for select to authenticated
  using (user_id=(select auth.uid()) and exists(select 1 from public.conversations c where c.id=conversation_reads.conversation_id and (select auth.uid()) in(c.user_low_id,c.user_high_id)));

create function public.complete_profile(p_handle text,p_display_name text) returns public.profiles
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

create function public.search_profiles(p_query text) returns table(id uuid,handle text,display_name text)
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

create function public.get_or_create_direct_conversation(p_recipient_id uuid) returns uuid
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

create function public.send_message(p_conversation_id uuid,p_client_message_id uuid,p_body text) returns public.messages
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

create function public.advance_read_cursor(p_conversation_id uuid,p_target_seq bigint) returns void
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

create function public.list_conversations() returns table(id uuid,peer_id uuid,handle text,display_name text,last_body text,last_message_at timestamptz,unread_count bigint,last_seq bigint)
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
create function public.notify_message() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform realtime.send(jsonb_build_object('conversation_id',new.conversation_id,'message_id',new.id,'seq',new.seq),'message','conversation:'||new.conversation_id::text,true);
  return new;
end; $$;
create trigger message_notification after insert on public.messages for each row execute function public.notify_message();
-- realtime.messages already has RLS managed by Supabase. Do not alter its owner/RLS.
create policy yapspace_private_receive on realtime.messages for select to authenticated using (
  extension='broadcast' and exists(select 1 from public.conversations c where 'conversation:'||c.id::text=(select realtime.topic()) and (select auth.uid()) in(c.user_low_id,c.user_high_id))
);

revoke all on function public.complete_profile(text,text),public.search_profiles(text),public.get_or_create_direct_conversation(uuid),public.send_message(uuid,uuid,text),public.advance_read_cursor(uuid,bigint),public.list_conversations(),public.notify_message() from public,anon,authenticated;
grant execute on function public.complete_profile(text,text),public.search_profiles(text),public.get_or_create_direct_conversation(uuid),public.send_message(uuid,uuid,text),public.advance_read_cursor(uuid,bigint),public.list_conversations() to authenticated;
commit;
