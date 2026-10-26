import { readFileSync,readdirSync,mkdirSync,writeFileSync,rmSync,realpathSync } from 'node:fs';
import { resolve,relative,join,dirname,basename } from 'node:path';
import { createHash } from 'node:crypto';
import { createStaticWorker } from '../worker/router.mjs';
const client=resolve('.site-build/client'),workspace=realpathSync(process.cwd()),output=resolve('dist');
if(dirname(output)!==workspace||basename(output)!=='dist')throw Error('Refusing to replace a build directory outside the workspace.');
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.woff':'font/woff','.woff2':'font/woff2'};
function list(path){return readdirSync(path,{withFileTypes:true}).flatMap(e=>e.isDirectory()?list(join(path,e.name)):[join(path,e.name)]);}
const assets={};for(const path of list(client)){const key='/'+relative(client,path).replaceAll('\\','/');if(key==='/_headers')continue;const bytes=readFileSync(path),extension='.'+path.split('.').at(-1);assets[key]={data:bytes.toString('base64'),size:bytes.length,type:types[extension]||'application/octet-stream',etag:'"'+createHash('sha256').update(bytes).digest('hex')+'"'};}
const headers={};let include=false;for(const line of readFileSync(join(client,'_headers'),'utf8').split(/\r?\n/)){if(line==='/*'){include=true;continue;}if(line.startsWith('/')){include=false;continue;}const m=line.match(/^\s+([^:]+):\s*(.*)$/);if(include&&m)headers[m[1]]=m[2];}
if(!headers['Content-Security-Policy'])throw Error('Worker security headers were not generated.');
// Only generated output is replaced, after the absolute path guard above.
rmSync(output,{recursive:true,force:true});mkdirSync(join(output,'server'),{recursive:true});
writeFileSync(join(output,'server/index.js'),'export default ('+createStaticWorker.toString()+')('+JSON.stringify(assets)+','+JSON.stringify(headers)+');\n');
console.log('Worker artifact built with '+Object.keys(assets).length+' embedded assets and enforced security headers.');
