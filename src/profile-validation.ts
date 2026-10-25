export { validateProfile, type ProfileInput } from '../supabase/functions/_shared/profile-input';
export function databaseError(error: { code?: string; message: string }): Error {
  if (['PGRST202','PGRST205','42703'].includes(error.code||'')) return new Error('The account service is temporarily unavailable. Please try again later. (SETUP_REQUIRED)');
  if (error.code === '23505') return new Error('That username is already taken. Try another one.');
  if (error.code === '23514') return new Error('Check your profile details. The name, username, or bio does not meet the allowed limits.');
  return new Error(error.message);
}
export class SessionExpiredError extends Error { constructor(){super('Your session has expired. Sign in again.');} }
export function requiresReauthentication(error:{status?:number;code?:string}):boolean {
  return [401,403].includes(error.status||0)||['bad_jwt','user_not_found','session_not_found','refresh_token_not_found'].includes(error.code||'');
}
