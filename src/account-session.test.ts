import {describe,it,expect,vi} from 'vitest';
import {accountProfileView,withAccountSession} from './account-session';
const tokenA='header.'+btoa(JSON.stringify({sub:'a'}))+'.signature',tokenB='header.'+btoa(JSON.stringify({sub:'b'}))+'.signature';
const profile={id:'a',handle:'alice',display_name:'Alice'};
describe('account setup boundary',()=>{
  it('returns an existing profile without onboarding',()=>expect(accountProfileView('a','a',profile,false,null)).toBe('ready'));
  it('never treats a failed lookup as new-account setup',()=>expect(accountProfileView('a','a',null,true,'a')).toBe('retry'));
  it('requires an explicit setup choice for an actually missing profile',()=>expect(accountProfileView('a','a',null,false,null)).toBe('missing'));
  it('allows explicit setup only for that account',()=>expect(accountProfileView('a','a',null,false,'a')).toBe('setup'));
  it('does not carry setup permission to another account',()=>expect(accountProfileView('b','b',null,false,'a')).toBe('missing'));
  it('waits for the current account lookup after an account switch',()=>expect(accountProfileView('b','a',profile,false,null)).toBe('loading'));
  it('rejects a profile belonging to a different identity',()=>expect(accountProfileView('b','b',profile,false,null)).toBe('retry'));
});
describe('profile requests bind the signed-in identity',()=>{
  it('rejects cached user metadata that disagrees with the bearer token',async()=>{const operation=vi.fn();await expect(withAccountSession('a',async()=>({access_token:tokenB,user:{id:'a'}}),operation)).rejects.toThrow('sign-in changed');expect(operation).not.toHaveBeenCalled();});
  it('does not make a request with another account session',async()=>{const operation=vi.fn();await expect(withAccountSession('a',async()=>({access_token:tokenB,user:{id:'b'}}),operation)).rejects.toThrow('sign-in changed');expect(operation).not.toHaveBeenCalled();});
  it('keeps the captured bearer token for the request',async()=>{const operation=vi.fn(async()=>profile);await expect(withAccountSession('a',async()=>({access_token:tokenA,user:{id:'a'}}),operation)).resolves.toBe(profile);expect(operation).toHaveBeenCalledWith(tokenA);});
  it('rejects an in-flight result after sign-out or account switching',async()=>{let current:{access_token:string;user:{id:string}}|null={access_token:tokenA,user:{id:'a'}};await expect(withAccountSession('a',async()=>current,async()=>{current={access_token:tokenB,user:{id:'b'}};return profile;})).rejects.toThrow('sign-in changed');});
  it('preserves request failures instead of returning a missing profile',async()=>{await expect(withAccountSession('a',async()=>({access_token:tokenA,user:{id:'a'}}),async()=>{throw Error('network unavailable');})).rejects.toThrow('network unavailable');});
});
