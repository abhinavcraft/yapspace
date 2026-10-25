import { describe,it,expect,vi } from 'vitest';
import { updateVerifiedProfile, type ProfileDependencies } from '../supabase/functions/_shared/profile-update';
import { databaseError } from './profile-validation';
const input={display_name:'Alex',handle:'alex.morgan',bio:'Hello',password:'correct-password'};
function dependencies(){return {identify:vi.fn(async()=>({id:'actor',email:'test@example.com'})),verifyPassword:vi.fn(async()=>({id:'actor'})),checkRateLimit:vi.fn(async()=>true),write:vi.fn(async()=>({id:'actor',display_name:'Alex'}))} satisfies ProfileDependencies;}
describe('password-protected profile updates',()=>{
  it('denies missing bearer tokens before any write',async()=>{const d=dependencies();await expect(updateVerifiedProfile('',input,d)).rejects.toMatchObject({status:401});expect(d.write).not.toHaveBeenCalled();});
  it('denies an invalid session even when a password is supplied',async()=>{const d=dependencies();d.identify.mockResolvedValue(null as never);await expect(updateVerifiedProfile('token',input,d)).rejects.toMatchObject({status:401});expect(d.verifyPassword).not.toHaveBeenCalled();expect(d.write).not.toHaveBeenCalled();});
  it('denies a wrong password',async()=>{const d=dependencies();d.verifyPassword.mockResolvedValue(null as never);await expect(updateVerifiedProfile('token',input,d)).rejects.toMatchObject({status:403});expect(d.write).not.toHaveBeenCalled();});
  it('requires a fresh password for the second update',async()=>{const d=dependencies();await updateVerifiedProfile('token',input,d);await expect(updateVerifiedProfile('token',{...input,password:''},d)).rejects.toMatchObject({status:400});expect(d.write).toHaveBeenCalledTimes(1);});
  it('verifies the password on every successful request',async()=>{const d=dependencies();await updateVerifiedProfile('token',input,d);await updateVerifiedProfile('token',{...input,bio:'Second change'},d);expect(d.verifyPassword).toHaveBeenCalledTimes(2);});
  it('rejects reauthentication as a different identity',async()=>{const d=dependencies();d.verifyPassword.mockResolvedValue({id:'other'});await expect(updateVerifiedProfile('token',input,d)).rejects.toMatchObject({status:403});expect(d.write).not.toHaveBeenCalled();});
  it('ignores a forged target user ID and excludes passwords from writes',async()=>{const d=dependencies();await updateVerifiedProfile('token',{...input,user_id:'victim'},d);expect(d.write).toHaveBeenCalledExactlyOnceWith('actor',{display_name:'Alex',handle:'alex.morgan',bio:'Hello'});});
  it('rejects reserved usernames and overlong bio before password verification',async()=>{const d=dependencies();await expect(updateVerifiedProfile('token',{...input,handle:'admin'},d)).rejects.toMatchObject({status:400});await expect(updateVerifiedProfile('token',{...input,bio:'🌿'.repeat(191)},d)).rejects.toMatchObject({status:400});expect(d.verifyPassword).not.toHaveBeenCalled();});
  it('blocks exhausted verification attempts before checking passwords',async()=>{const d=dependencies();d.checkRateLimit.mockResolvedValue(false);await expect(updateVerifiedProfile('token',input,d)).rejects.toMatchObject({status:429});expect(d.verifyPassword).not.toHaveBeenCalled();expect(d.write).not.toHaveBeenCalled();});
  it('provides the SQL recovery path for missing functions',()=>expect(databaseError({code:'PGRST202',message:'missing'}).message).toContain('SETUP_REQUIRED'));
});
