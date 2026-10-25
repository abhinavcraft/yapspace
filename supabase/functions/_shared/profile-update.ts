import { validateProfile, type ProfileInput } from './profile-input.ts';
export class ProfileError extends Error { constructor(message:string,public status:number){super(message);} }
export type ProfileDependencies = {
  identify:(token:string)=>Promise<{id:string;email?:string}|null>;
  verifyPassword:(email:string,password:string)=>Promise<{id:string}|null>;
  write:(id:string,input:ProfileInput)=>Promise<unknown>;
};
export async function updateVerifiedProfile(token:string,input:unknown,deps:ProfileDependencies):Promise<unknown>{
  if(!token)throw new ProfileError('Sign in again before editing your profile.',401);
  const actor=await deps.identify(token);if(!actor?.id||!actor.email)throw new ProfileError('Sign in with an email and password to edit your profile.',401);
  if(!input||typeof input!=='object')throw new ProfileError('Invalid profile details.',400);
  const body=input as Record<string,unknown>;
  if(typeof body.display_name!=='string'||typeof body.handle!=='string'||typeof body.bio!=='string'||typeof body.password!=='string'||!body.password||body.password.length>1024)throw new ProfileError('Enter your profile details and current password.',400);
  const profile={display_name:body.display_name.trim(),handle:body.handle,bio:body.bio};const invalid=validateProfile(profile);if(invalid)throw new ProfileError(invalid,400);
  // Verification is request-scoped and never cached or accepted from the browser.
  const verified=await deps.verifyPassword(actor.email,body.password);
  if(!verified||verified.id!==actor.id)throw new ProfileError('Your password didn’t match. Please try again.',403);
  // Target ID is derived only from the validated bearer session.
  return deps.write(actor.id,profile);
}
