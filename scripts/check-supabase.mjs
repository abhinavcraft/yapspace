import { readFileSync, existsSync } from 'node:fs';
const env={};
for(const file of ['.env','.env.local'])if(existsSync(file))for(const line of readFileSync(file,'utf8').split(/\r?\n/)){const m=line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);if(m)env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');}
const url=process.env.VITE_SUPABASE_URL||env.VITE_SUPABASE_URL,key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY||env.VITE_SUPABASE_PUBLISHABLE_KEY;
if(!url||!key?.startsWith('sb_publishable_')){console.error('Set VITE_SUPABASE_URL and a public sb_publishable_ key in .env.local first.');process.exit(1);}
let missing=false;
const functions={complete_profile:{p_handle:'setup_check',p_display_name:'Setup check'},list_conversations:{},search_profiles:{p_query:'setup'},get_or_create_direct_conversation:{p_recipient_id:'00000000-0000-0000-0000-000000000000'},send_message:{p_conversation_id:'00000000-0000-0000-0000-000000000000',p_client_message_id:'00000000-0000-0000-0000-000000000000',p_body:'setup check'},advance_read_cursor:{p_conversation_id:'00000000-0000-0000-0000-000000000000',p_target_seq:0}};
// No user token: all calls must be denied. A 42501 proves the RPC is exposed but
// safely unavailable to anonymous callers. No test account or row is created.
try{for(const [name,params] of Object.entries(functions)){
  const response=await fetch(new URL('/rest/v1/rpc/'+name,url),{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(params),signal:AbortSignal.timeout(10000)});
  const data=await response.json();
  if(data.code==='42501')console.log(`OK ${name}: installed, anonymous execution denied`);
  else if(data.code==='PGRST202'){missing=true;console.log(`MISSING ${name}`);}
  else{missing=true;console.log(`CHECK ${name}: HTTP ${response.status}, code ${data.code||'unknown'}`);}
}
if(missing){console.error('\nRun supabase/setup.sql in your connected Supabase SQL Editor, wait a few seconds, then rerun npm run check:setup.');process.exitCode=1;}
else console.log('\nAll core RPCs are installed. Live authenticated messaging still requires its separate acceptance checks.');
const limiter=await fetch(new URL('/rest/v1/rpc/consume_profile_verification',url),{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({p_user_id:'00000000-0000-0000-0000-000000000000'}),signal:AbortSignal.timeout(10000)});
if((await limiter.json()).code!=='42501'){console.error('MISSING server-only profile verification limiter. Apply migration 20261025155628_production_hardening.sql.');process.exitCode=1;}
else console.log('OK profile limiter installed; client execution denied');
const edge=await fetch(new URL('/functions/v1/update-profile',url),{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(10000)});
if(edge.status!==401){console.error(`CHECK profile Edge Function: HTTP ${edge.status}. Deploy update-profile and verify that missing user tokens are rejected with 401.`);process.exitCode=1;}
else console.log('OK profile Edge Function rejects missing user tokens');
}catch{console.error('Could not reach Supabase. Check the project URL and network connection.');process.exitCode=1;}
