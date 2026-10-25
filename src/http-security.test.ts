import { describe,it,expect } from 'vitest';
import { allowedOrigin,readBoundedJSON } from '../supabase/functions/_shared/http-security';
describe('profile endpoint request boundary',()=>{
  it('accepts only an exact configured origin',()=>{expect(allowedOrigin('https://app.example','https://app.example, https://other.example')).toBe('https://app.example');expect(allowedOrigin('https://app.example.attacker.test','https://app.example')).toBeNull();expect(allowedOrigin('null','https://app.example')).toBeNull();});
  it('reads a normal JSON body',async()=>expect(await readBoundedJSON(new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"value":1}'}))).toEqual({value:1}));
  it('refuses oversized chunked bodies without trusting Content-Length',async()=>{const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(5000));c.enqueue(new Uint8Array(5000));c.close();}});await expect(readBoundedJSON(new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json'},body,duplex:'half'} as RequestInit))).rejects.toThrow('too-large');});
  it('counts UTF-8 bytes rather than JavaScript string length',async()=>await expect(readBoundedJSON(new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bio:'🌿'.repeat(2100)})}))).rejects.toThrow('too-large'));
  it('rejects invalid JSON and unexpected content types',async()=>{await expect(readBoundedJSON(new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'}))).rejects.toThrow('json');await expect(readBoundedJSON(new Request('https://example.test',{method:'POST',body:'{}'}))).rejects.toThrow('content-type');});
});
