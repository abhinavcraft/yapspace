import {readFileSync} from 'node:fs';
import {readBuildEnv,validateBuildEnv} from './env.mjs';
const {url,demo}=validateBuildEnv(readBuildEnv());
if(demo)throw Error('Vercel production releases must not enable the demo.');
const config=JSON.parse(readFileSync('vercel.json','utf8'));
const csp=config.headers.flatMap(x=>x.headers).find(x=>x.key==='Content-Security-Policy')?.value;
if(!csp?.includes('connect-src \'self\' '+url+' '+url.replace('https:','wss:')+';'))throw Error('Vercel CSP does not match this Supabase project. Update vercel.json before deploying.');
console.log('Vercel production configuration and exact Supabase CSP passed.');
