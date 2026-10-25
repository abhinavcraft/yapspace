import { describe,it,expect } from 'vitest';
// @ts-expect-error ESM worker factory is JavaScript shared with the build.
import { createStaticWorker } from '../worker/router.mjs';
const worker=createStaticWorker({'/index.html':{data:btoa('YapSpace'),type:'text/html; charset=utf-8',size:8,etag:'"html"'},'/assets/test.js':{data:btoa('test'),type:'application/javascript',size:4,etag:'"js"'}},{'Content-Security-Policy':"default-src 'self'; object-src 'none'",'X-Content-Type-Options':'nosniff'});
describe('deployed security response boundary',()=>{
  it('serves the app shell with actual security headers',async()=>{const r=await worker.fetch(new Request('https://example.test/'));expect(await r.text()).toBe('YapSpace');expect(r.headers.get('x-content-type-options')).toBe('nosniff');expect(r.headers.get('content-security-policy')).toContain("object-src 'none'");});
  it('returns headers on unknown routes and rejects mutation verbs',async()=>{expect((await worker.fetch(new Request('https://example.test/missing'))).status).toBe(404);const r=await worker.fetch(new Request('https://example.test/',{method:'POST'}));expect(r.status).toBe(405);expect(r.headers.get('x-content-type-options')).toBe('nosniff');});
  it('caches hashed assets and handles conditional requests',async()=>{const r=await worker.fetch(new Request('https://example.test/assets/test.js'));expect(r.headers.get('cache-control')).toContain('immutable');const cached=await worker.fetch(new Request('https://example.test/assets/test.js',{headers:{'if-none-match':'"js"'}}));expect(cached.status).toBe(304);expect(await cached.text()).toBe('');});
  it('serves HEAD without leaking a response body',async()=>{const r=await worker.fetch(new Request('https://example.test/',{method:'HEAD'}));expect(r.headers.get('content-length')).toBe('8');expect(await r.text()).toBe('');});
});
