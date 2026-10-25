// No credentials or user state live in this Worker: Sites owns access control,
// Supabase owns accounts/messages. This layer only serves built static bytes.
export function createStaticWorker(assets,securityHeaders){
  return {async fetch(request){
    const path=new URL(request.url).pathname;
    const headers=new Headers(securityHeaders);
    if(!['GET','HEAD'].includes(request.method)){headers.set('Allow','GET, HEAD');return new Response('Method not allowed',{status:405,headers});}
    const asset=assets[path==='/'?'/index.html':path];
    if(!asset){headers.set('Content-Type','text/plain; charset=utf-8');return new Response(request.method==='HEAD'?null:'Not found',{status:404,headers});}
    headers.set('Content-Type',asset.type);headers.set('ETag',asset.etag);
    headers.set('Cache-Control',path.startsWith('/assets/')?'public, max-age=31536000, immutable':path==='/health.json'?'no-store':'no-cache');
    if(request.headers.get('if-none-match')===asset.etag)return new Response(null,{status:304,headers});
    headers.set('Content-Length',String(asset.size));
    return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0)),{headers});
  }};
}
