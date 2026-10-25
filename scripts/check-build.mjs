import { readFileSync,readdirSync,writeFileSync,existsSync } from 'node:fs';
import { join } from 'node:path';
import { readBuildEnv,validateBuildEnv } from './env.mjs';
const config=validateBuildEnv(readBuildEnv());
function files(path){return readdirSync(path,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(path,e.name)):[join(path,e.name)]);}
for(const path of files('.site-build/client').filter(p=>/\.(js|css|html|json|map)$/.test(p))){const body=readFileSync(path,'utf8');if(/sb_secret_[A-Za-z0-9_-]{20,}/.test(body))throw Error('A secret key was detected in build output.');for(const token of body.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)){try{if(JSON.parse(Buffer.from(token[1],'base64url').toString()).role==='service_role')throw Error('privileged-key');}catch(e){if(e.message==='privileged-key')throw Error('A privileged JWT was detected in build output.');}}}
if(!existsSync('.site-build/client/_headers'))throw Error('Security headers are missing from the build.');
let headers=readFileSync('.site-build/client/_headers','utf8');
if(config.url)headers=headers.replaceAll('https://*.supabase.co',config.url).replaceAll('wss://*.supabase.co',config.url.replace('https:','wss:'));
writeFileSync('.site-build/client/_headers',headers);
writeFileSync('.site-build/client/health.json',JSON.stringify({app:'YapSpace',build:new Date().toISOString(),mode:config.demo?'demo':'production',scope:'static assets only'})+'\n');
console.log('Build secret scan and security-header packaging passed.');
