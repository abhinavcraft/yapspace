import { existsSync,readFileSync } from 'node:fs';
export function readBuildEnv(){const env={};for(const file of ['.env','.env.local','.env.production','.env.production.local'])if(existsSync(file))for(const line of readFileSync(file,'utf8').split(/\r?\n/)){const m=line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);if(m)env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');}return {...env,...process.env};}
export function validateBuildEnv(env){
  if(env.VITE_APP_URL){const app=new URL(env.VITE_APP_URL);if(app.protocol!=='https:'||app.username||app.password||app.pathname!=='/'||app.search||app.hash)throw new Error('VITE_APP_URL must be an HTTPS origin without credentials, paths, queries or fragments.');}
  const demo=env.VITE_ENABLE_DEMO==='true',url=env.VITE_SUPABASE_URL,key=env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if(!url&&!key&&demo)return {demo:true};
  if(!url||!key?.startsWith('sb_publishable_'))throw new Error('Production builds require VITE_SUPABASE_URL and a public sb_publishable_ key. Demo builds must explicitly set VITE_ENABLE_DEMO=true.');
  const parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.search||parsed.hash||!parsed.hostname.endsWith('.supabase.co'))throw new Error('Use your HTTPS Supabase project URL without credentials, query parameters, or fragments.');
  return {demo,url:parsed.origin};
}
