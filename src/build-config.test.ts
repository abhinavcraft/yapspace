import { describe,it,expect } from 'vitest';
// @ts-expect-error Node build helper has no separate TypeScript declaration.
import { validateBuildEnv } from '../scripts/env.mjs';
describe('production configuration gate',()=>{
  it('refuses accidental demo fallbacks',()=>expect(()=>validateBuildEnv({})).toThrow('Production builds require'));
  it('refuses a privileged browser key',()=>expect(()=>validateBuildEnv({VITE_SUPABASE_URL:'https://test.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_secret_do_not_use'})).toThrow());
  it('refuses URLs carrying credentials or query data',()=>expect(()=>validateBuildEnv({VITE_SUPABASE_URL:'https://user:password@test.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'})).toThrow());
  it('allows an explicit isolated demo build',()=>expect(validateBuildEnv({VITE_ENABLE_DEMO:'true'})).toEqual({demo:true}));
});
