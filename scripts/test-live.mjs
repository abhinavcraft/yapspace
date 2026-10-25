import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { existsSync,readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { readBuildEnv } from './env.mjs';
const env={...readBuildEnv()};
if(existsSync('.env.acceptance.local'))for(const line of readFileSync('.env.acceptance.local','utf8').split(/\r?\n/)){const m=line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);if(m&&!process.env[m[1]])env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');}
const url=env.YAPSPACE_TEST_SUPABASE_URL,key=env.YAPSPACE_TEST_SUPABASE_KEY;
const required=['YAPSPACE_TEST_SUPABASE_URL','YAPSPACE_TEST_SUPABASE_KEY',...['A','B','C'].flatMap(id=>[`YAPSPACE_TEST_${id}_EMAIL`,`YAPSPACE_TEST_${id}_PASSWORD`])];
if(required.some(name=>!env[name]))throw Error('Configure the separate staging project and three disposable accounts in .env.acceptance.local. No credentials should be pasted into chat.');
if(new URL(url).origin===new URL(env.VITE_SUPABASE_URL).origin)throw Error('Refusing to create test messages in the configured production project. Use a separate staging project.');
const clients=['A','B','C'].map(()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}));
const channels=[];const users=[];let passed=0;
const check=(condition,label)=>{assert.ok(condition,label);passed++;console.log('PASS '+label);};
async function rpc(client,name,args){const {data,error}=await client.rpc(name,args);assert.ok(!error,`RPC ${name} failed`);return data;}
async function channel(client,id){const channel=client.channel('conversation:'+id,{config:{private:true}});channels.push([client,channel]);return channel;}
async function subscribe(ch){return new Promise(resolve=>{const timer=setTimeout(()=>resolve('TIMED_OUT'),12000);ch.subscribe(status=>{if(['SUBSCRIBED','CHANNEL_ERROR','CLOSED','TIMED_OUT'].includes(status)){clearTimeout(timer);resolve(status);}});});}
try{
  for(const [i,id] of ['A','B','C'].entries()){
    const {data,error}=await clients[i].auth.signInWithPassword({email:env[`YAPSPACE_TEST_${id}_EMAIL`],password:env[`YAPSPACE_TEST_${id}_PASSWORD`]});
    assert.ok(!error&&data.user&&data.session,'Staging account sign-in failed');users.push(data.user);await clients[i].realtime.setAuth(data.session.access_token);
    await rpc(clients[i],'complete_profile',{p_handle:'qa_'+id.toLowerCase()+'_'+Date.now().toString(36),p_display_name:'QA '+id});
  }
  check(new Set(users.map(u=>u.id)).size===3,'three distinct authenticated staging identities');
  const [a,b,c]=clients;
  const pair=await rpc(a,'get_or_create_direct_conversation',{p_recipient_id:users[1].id});
  check(pair===await rpc(b,'get_or_create_direct_conversation',{p_recipient_id:users[0].id}),'one conversation for a reversed user pair');
  const outsider=await c.from('messages').select('id').eq('conversation_id',pair);check(!outsider.error&&outsider.data.length===0,'outsider cannot retrieve conversation messages');
  const unauthorized=await c.rpc('send_message',{p_conversation_id:pair,p_client_message_id:randomUUID(),p_body:'Staging denial fixture'});check(unauthorized.error?.code==='42501','outsider cannot write into a guessed conversation');
  const privateB=await channel(b,pair);let eventResolve;const event=new Promise(resolve=>{eventResolve=resolve;});privateB.on('broadcast',{event:'message'},()=>eventResolve(true));
  check(await subscribe(privateB)==='SUBSCRIBED','participant can subscribe to the private channel');
  const privateC=await channel(c,pair);check(await subscribe(privateC)==='CHANNEL_ERROR','outsider private-channel subscription is rejected');
  const messageKey=randomUUID(),body='YapSpace staging acceptance '+randomUUID();
  const sent=await rpc(a,'send_message',{p_conversation_id:pair,p_client_message_id:messageKey,p_body:body});const first=Array.isArray(sent)?sent[0]:sent;
  check(await Promise.race([event,new Promise(resolve=>setTimeout(()=>resolve(false),10000))]),'database-originated live notification arrives');
  const retried=await rpc(a,'send_message',{p_conversation_id:pair,p_client_message_id:messageKey,p_body:body});check((Array.isArray(retried)?retried[0]:retried).id===first.id,'retry returns the canonical message');
  const collision=await a.rpc('send_message',{p_conversation_id:pair,p_client_message_id:messageKey,p_body:'Changed fixture'});check(collision.error?.code==='22023','retry key rejects modified content');
  const saved=await b.from('messages').select('id,seq').eq('conversation_id',pair).eq('client_message_id',messageKey);check(!saved.error&&saved.data.length===1,'recipient fetches exactly one persisted message');
  await b.removeChannel(privateB);
  const missing=await rpc(a,'send_message',{p_conversation_id:pair,p_client_message_id:randomUUID(),p_body:'Staging catch-up fixture'});const second=Array.isArray(missing)?missing[0]:missing;
  const catchup=await b.from('messages').select('id,seq').eq('conversation_id',pair).gt('seq',first.seq).order('seq');check(!catchup.error&&catchup.data.some(m=>m.id===second.id),'database catch-up retrieves a missed live event');
  const profile=await a.from('profiles').select('handle,display_name,bio').eq('id',users[0].id).single();assert.ok(profile.data,'Staging profile missing');
  const rejected=await a.functions.invoke('update-profile',{body:{...profile.data,password:randomUUID()}});check(rejected.error?.context?.status===403,'incorrect password cannot update profile');
  const updated=await a.functions.invoke('update-profile',{body:{...profile.data,password:env.YAPSPACE_TEST_A_PASSWORD}});check(!updated.error&&updated.data.id===users[0].id,'correct password verifies a profile save through the deployed function');
  console.log(`\n${passed} live staging checks passed. These are not a load test, SMTP test, or backup-restore test.`);
}finally{
 await Promise.allSettled(channels.map(([client,ch])=>client.removeChannel(ch)));
 await Promise.allSettled(clients.map(client=>client.auth.signOut({scope:'local'})));
}
