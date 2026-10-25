import {describe,it,expect} from 'vitest';
import {authRedirectUrl} from './auth-redirect';
describe('email callback destination',()=>{
  it('uses the production domain from preview origins',()=>expect(authRedirectUrl('https://yapspace.lol','https://preview.vercel.app')).toBe('https://yapspace.lol/'));
  it('keeps a stable root callback when no canonical domain is configured',()=>expect(authRedirectUrl(undefined,'https://yapspace.vercel.app')).toBe('https://yapspace.vercel.app/'));
  it('allows explicit loopback development',()=>expect(authRedirectUrl(undefined,'http://localhost:5173')).toBe('http://localhost:5173/'));
  it.each(['http://yapspace.lol','https://user:password@yapspace.lol','https://yapspace.lol/?next=evil','https://yapspace.lol/#token','javascript:alert(1)'])('refuses unsafe callbacks %s',value=>expect(()=>authRedirectUrl(value,'https://yapspace.lol')).toThrow());
});
