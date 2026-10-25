import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { ProfileError, updateVerifiedProfile } from '../_shared/profile-update.ts';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','Content-Type':'application/json'};
Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response(null,{headers:cors});
  if(request.method!=='POST')return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers:cors});
  if(Number(request.headers.get('content-length')||0)>8192)return new Response(JSON.stringify({error:'Request too large'}),{status:413,headers:cors});
  const url=Deno.env.get('SUPABASE_URL')!;const key=Deno.env.get('SUPABASE_ANON_KEY')!;
  const authOptions={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
  const caller=createClient(url,key,authOptions), verifier=createClient(url,key,authOptions);
  try{
    const raw=await request.text();if(raw.length>8192)throw new ProfileError('Request too large',413);
    let body:unknown;try{body=JSON.parse(raw);}catch{throw new ProfileError('Invalid request',400);}
    const token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'')||'';
    const result=await updateVerifiedProfile(token,body,{
      identify:async token=>{const {data,error}=await caller.auth.getUser(token);return error?null:data.user;},
      verifyPassword:async(email,password)=>{const {data,error}=await verifier.auth.signInWithPassword({email,password});return error?null:data.user;},
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
