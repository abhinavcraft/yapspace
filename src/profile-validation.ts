export { validateProfile, type ProfileInput } from '../supabase/functions/_shared/profile-input';
export function databaseError(error: { code?: string; message: string }): Error {
  if (error.code === 'PGRST202' || error.code === 'PGRST205') return new Error('Your Supabase database setup is incomplete. Run supabase/setup.sql in your project’s SQL Editor, wait a few seconds, then try again.');
  return new Error(error.message);
}
