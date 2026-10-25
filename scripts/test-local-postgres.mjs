import { execFileSync } from 'node:child_process';
import { mkdtempSync,realpathSync,rmSync,readFileSync } from 'node:fs';
import { join,dirname,basename } from 'node:path';
import { createServer } from 'node:net';
import { Client } from 'pg';
if(process.platform!=='win32')throw Error('Use the PostgreSQL CI service or YAPSPACE_TEST_DATABASE_URL on this platform. This local launcher is Windows-only.');
const {initdb,pg_ctl}=await import('@embedded-postgres/windows-x64');
const workspace=realpathSync(process.cwd()),directory=mkdtempSync(join(workspace,'.local-postgres-')),data=join(directory,'data'),log=join(directory,'postgres.log');
const listener=createServer();await new Promise((resolve,reject)=>{listener.once('error',reject);listener.listen(0,'127.0.0.1',resolve);});const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
let launched=false,stopped=false;
function run(binary,args){return execFileSync(binary,args,{cwd:workspace,stdio:'pipe',timeout:90000,windowsHide:true}).toString();}
try{
  // This fresh cluster has only synthetic fixtures, binds loopback, and never
  // loads .env or any production credential. No Windows service/user is created.
  run(initdb,['-D',data,'-U','postgres','-A','trust','--encoding=UTF8','--locale=C']);
  launched=true;run(pg_ctl,['-D',data,'-l',log,'-o',`-h 127.0.0.1 -p ${port} -F`,'-w','start']);
  const client=new Client({host:'127.0.0.1',port,user:'postgres',database:'postgres'});await client.connect();
  try{console.log((await client.query('select version() as version')).rows[0].version);await client.query('create database yapspace_test');}finally{await client.end();}
  execFileSync(process.execPath,['scripts/test-database.mjs'],{cwd:workspace,stdio:'inherit',timeout:120000,windowsHide:true,env:{...process.env,YAPSPACE_TEST_DATABASE_URL:`postgresql://postgres@127.0.0.1:${port}/yapspace_test`}});
}catch(error){if(error.stdout)console.error(String(error.stdout).slice(-3000));if(error.stderr)console.error(String(error.stderr).slice(-3000));if(launched){try{console.error(readFileSync(log,'utf8').slice(-3000));}catch{}}throw error;}
finally{
  if(launched){try{run(pg_ctl,['-D',data,'-m','fast','-w','stop']);stopped=true;}catch{console.error('Could not confirm test-cluster shutdown; generated data was retained at '+directory);}}
  else stopped=true;
  // Resolve the absolute generated directory before any recursive removal.
  if(stopped){const target=realpathSync(directory);if(dirname(target)!==workspace||!basename(target).startsWith('.local-postgres-'))throw Error('Refusing cleanup outside the generated test directory.');rmSync(target,{recursive:true,force:true});console.log('Disposable local PostgreSQL cluster stopped and removed.');}
}
