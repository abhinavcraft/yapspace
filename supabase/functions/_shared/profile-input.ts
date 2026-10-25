export type ProfileInput = { display_name: string; handle: string; bio: string };
export function validateProfile(input: ProfileInput): string | null {
  if (!input.display_name.trim() || [...input.display_name.trim()].length > 60) return 'Your display name must be 1–60 characters.';
  if (!/^[a-z0-9][a-z0-9_.]{2,23}$/.test(input.handle)) return 'Choose a username with 3–24 lowercase letters, numbers, dots, or underscores.';
  if (['admin','administrator','support','system','yapspace'].includes(input.handle)) return 'That username is reserved. Try another one.';
  if ([...input.bio].length > 190) return 'Keep your about me under 190 characters.';
  return null;
}
