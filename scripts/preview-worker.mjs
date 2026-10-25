import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const {default:worker}=await import(pathToFileURL(resolve('dist/server/index.js')).href);
const server=createServer(async(req,res)=>{
  try{const request=new Request(new URL(req.url,'http://127.0.0.1:5174'),{method:req.method,headers:req.headers});const response=await worker.fetch(request,{},{});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}
  catch{res.writeHead(500,{'Content-Type':'text/plain'});res.end('Preview request failed');}
});
server.listen(5174,'127.0.0.1',()=>console.log('Built Worker preview: http://127.0.0.1:5174/'));
