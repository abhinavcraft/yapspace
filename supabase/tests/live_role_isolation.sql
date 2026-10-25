-- Read/write fixtures exist only inside this transaction. No emails, passwords,
-- sessions, schema changes, or permanent user/message rows are created. Any failed
-- assertion aborts the transaction. ROLLBACK removes all test rows and notifications.
begin;
do $$
declare
  a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
  chat uuid; retry_key uuid:=gen_random_uuid(); first_message public.messages; retried public.messages;
  denied boolean; total bigint; checks integer:=0;
begin
  insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at)
  values(a,'authenticated','authenticated','qa-'||a::text||'@example.invalid',now(),now(),now()),
        (b,'authenticated','authenticated','qa-'||b::text||'@example.invalid',now(),now(),now()),
        (c,'authenticated','authenticated','qa-'||c::text||'@example.invalid',now(),now(),now());
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claim.sub',a::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
  perform public.complete_profile('qa_'||left(replace(a::text,'-',''),12),'QA A');
  perform set_config('request.jwt.claim.sub',b::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
  perform public.complete_profile('qa_'||left(replace(b::text,'-',''),12),'QA B');
  perform set_config('request.jwt.claim.sub',c::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',c,'role','authenticated')::text,true);
  perform public.complete_profile('qa_'||left(replace(c::text,'-',''),12),'QA C');
  perform set_config('request.jwt.claim.sub',a::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
  chat:=public.get_or_create_direct_conversation(b);
  first_message:=public.send_message(chat,retry_key,'Transactional acceptance fixture');
  if first_message.sender_id<>a or first_message.seq<>1 then raise exception 'Sender/sequence assertion failed'; end if;checks:=checks+1;
  retried:=public.send_message(chat,retry_key,'Transactional acceptance fixture');
  if retried.id<>first_message.id then raise exception 'Retry idempotency assertion failed'; end if;checks:=checks+1;
  denied:=false;begin perform public.send_message(chat,retry_key,'Mismatched fixture');exception when invalid_parameter_value then denied:=true;end;
  if not denied then raise exception 'Retry collision assertion failed';end if;checks:=checks+1;
  perform set_config('request.jwt.claim.sub',b::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
  if public.get_or_create_direct_conversation(a)<>chat then raise exception 'Canonical pair assertion failed';end if;checks:=checks+1;
  select count(*) into total from public.messages where conversation_id=chat;
  if total<>1 then raise exception 'Participant history assertion failed';end if;checks:=checks+1;
  perform public.advance_read_cursor(chat,100);perform public.advance_read_cursor(chat,0);
  select last_read_seq into total from public.conversation_reads where conversation_id=chat and user_id=b;
  if total<>1 then raise exception 'Monotonic read assertion failed';end if;checks:=checks+1;
  perform set_config('realtime.topic','conversation:'||chat::text,true);
  select count(*) into total from realtime.messages where topic='conversation:'||chat::text;
  if total<>1 then raise exception 'Participant topic authorization assertion failed';end if;checks:=checks+1;
  perform set_config('request.jwt.claim.sub',c::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',c,'role','authenticated')::text,true);
  select count(*) into total from public.messages where conversation_id=chat;
  if total<>0 then raise exception 'Outsider history isolation assertion failed';end if;checks:=checks+1;
  select count(*) into total from public.conversations where id=chat;
  if total<>0 then raise exception 'Outsider conversation isolation assertion failed';end if;checks:=checks+1;
  select count(*) into total from realtime.messages where topic='conversation:'||chat::text;
  if total<>0 then raise exception 'Outsider topic isolation assertion failed';end if;checks:=checks+1;
  denied:=false;begin perform public.send_message(chat,gen_random_uuid(),'Denied fixture');exception when insufficient_privilege then denied:=true;end;
  if not denied then raise exception 'Outsider send denial assertion failed';end if;checks:=checks+1;
  denied:=false;begin perform public.advance_read_cursor(chat,1);exception when insufficient_privilege then denied:=true;end;
  if not denied then raise exception 'Outsider read-cursor denial assertion failed';end if;checks:=checks+1;
  denied:=false;begin perform public.update_profile_verified(a,'spoofed_fixture','Denied','Denied');exception when insufficient_privilege then denied:=true;end;
  if not denied then raise exception 'Profile verification bypass assertion failed';end if;checks:=checks+1;
  perform set_config('role','anon',true);perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{}',true);
  denied:=false;begin perform count(*) from public.messages;exception when insufficient_privilege then denied:=true;end;
  if not denied then raise exception 'Anonymous history denial assertion failed';end if;checks:=checks+1;
  perform set_config('role','service_role',true);
  for total in 1..5 loop if not public.consume_profile_verification(a) then raise exception 'Verification rate window assertion failed';end if;end loop;
  if public.consume_profile_verification(a) then raise exception 'Verification rate denial assertion failed';end if;checks:=checks+1;
  perform public.update_profile_verified(a,'qa_'||left(replace(a::text,'-',''),12),'QA A verified','Verified fixture');
  perform set_config('role','authenticated',true);perform set_config('request.jwt.claim.sub',a::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
  if (select display_name from public.profiles where id=a)<>'QA A verified' then raise exception 'Verified server profile write assertion failed';end if;checks:=checks+1;
  perform public.complete_profile('qa_bypass_fixture','Attempted bypass');
  if (select display_name from public.profiles where id=a)<>'QA A verified' then raise exception 'Registration profile overwrite denial assertion failed';end if;checks:=checks+1;
  perform set_config('role','none',true);
  perform set_config('yapspace.acceptance_result',jsonb_build_object('passed',checks,'fixture_rows_committed',0,'scope','live PostgreSQL roles; not JWT/WebSocket authentication')::text,true);
end; $$;
select current_setting('yapspace.acceptance_result')::jsonb as acceptance_result;
rollback;
