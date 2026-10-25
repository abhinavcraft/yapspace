import type { Profile } from './types';

type AccountSession={access_token:string;user:{id:string}}|null;
function tokenAccountId(token:string):unknown{try{return JSON.parse(atob(token.split('.')[1].replaceAll('-','+').replaceAll('_','/'))).sub;}catch{return null;}}
export async function withAccountSession<T>(accountId:string,getSession:()=>Promise<AccountSession>,operation:(token:string)=>Promise<T>):Promise<T>{
  const session=await getSession();
  // This is a cache-consistency check, not JWT validation. Supabase verifies the
  // token signature and applies RLS when the captured token reaches the server.
  if(!session?.access_token||session.user.id!==accountId||tokenAccountId(session.access_token)!==accountId)throw new Error('Your sign-in changed. Sign in again to continue.');
  // The request must use this token, rather than a token from a later session.
  const result=await operation(session.access_token);
  if((await getSession())?.user.id!==accountId)throw new Error('Your sign-in changed. Sign in again to continue.');
  return result;
}

export function accountProfileView(accountId:string,loadedFor:string|null,profile:Profile|null,failed:boolean,setupFor:string|null):'loading'|'retry'|'ready'|'missing'|'setup'{
  if(loadedFor!==accountId)return 'loading';
  if(failed||(profile!==null&&profile.id!==accountId))return 'retry';
  if(profile)return 'ready';
  // A missing row is never permission to create an account automatically.
  return setupFor===accountId?'setup':'missing';
}
