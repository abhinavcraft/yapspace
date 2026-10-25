import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { ProfileError, updateVerifiedProfile } from '../_shared/profile-update.ts';
import { allowedOrigin, readBoundedJSON } from '../_shared/http-security.ts';

Deno.serve(async request=>{
  const origin=request.headers.get('origin');
  const allowed=allowedOrigin(origin,Deno.env.get('YAPSPACE_ALLOWED_ORIGINS')||'https://yapspace.lol,https://yapspace-agnivya.vercel.app,https://yapspace-beta.vercel.app,https://yapspace-private-messaging.vocaldaisy6.chatgpt.site');
  const cors:Record<string,string>={'Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','Content-Type':'application/json','X-Content-Type-Options':'nosniff','Vary':'Origin'};
  if(allowed)cors['Access-Control-Allow-Origin']=allowed;
  if(origin&&!allowed)return new Response(JSON.stringify({error:'Origin not allowed'}),{status:403,headers:cors});
  if(request.method==='OPTIONS')return new Response(null,{headers:cors});
  if(request.method!=='POST')return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers:cors});
  const url=Deno.env.get('SUPABASE_URL');const key=Deno.env.get('SUPABASE_ANON_KEY');
  if(!url||!key||!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))return new Response(JSON.stringify({error:'Account verification is temporarily unavailable'}),{status:503,headers:cors});
  const authOptions={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input:RequestInfo|URL,init?:RequestInit)=>fetch(input,{...init,signal:AbortSignal.any([...(init?.signal?[init.signal]:[]),AbortSignal.timeout(10000)])})}};
  const caller=createClient(url,key,authOptions), verifier=createClient(url,key,authOptions);
  try{
    let body:unknown;try{body=await readBoundedJSON(request);}catch(e){const type=(e as Error).message;throw new ProfileError(type==='too-large'?'Request too large':'Send a valid JSON request',type==='too-large'?413:400);}
    const token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'')||'';
    const result=await updateVerifiedProfile(token,body,{
      identify:async token=>{const {data,error}=await caller.auth.getUser(token);return error?null:data.user;},
      verifyPassword:async(email,password)=>{const {data,error}=await verifier.auth.signInWithPassword({email,password});return error?null:data.user;},
      checkRateLimit:async id=>{const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,authOptions);const {data,error}=await admin.rpc('consume_profile_verification',{p_user_id:id});if(error)throw new ProfileError('Profile verification is temporarily unavailable.',503);return data===true;},
      write:async(id,input)=>{
        // Supabase injects this server-only secret into Edge Functions. Never send
        // it to browsers. The narrow RPC is unavailable to authenticated clients.
        const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,authOptions);
        const {data,error}=await admin.rpc('update_profile_verified',{p_user_id:id,p_handle:input.handle,p_display_name:input.display_name,p_bio:input.bio}).single();
        if(error){if(error.code==='23505')throw new ProfileError('That username is taken. Try another one.',409);throw new ProfileError('Profile could not be saved. Check the database setup.',500);}
        return data;
      }
    });
    return new Response(JSON.stringify(result),{headers:cors});
  }catch(error){return new Response(JSON.stringify({error:error instanceof ProfileError?error.message:'Unable to update your profile. Try again.'}),{status:error instanceof ProfileError?error.status:500,headers:cors});}
  finally{await verifier.auth.signOut({scope:'local'}).catch(()=>{});}
});
