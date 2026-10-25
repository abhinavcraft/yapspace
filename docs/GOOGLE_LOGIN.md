# Google sign-in

The sign-in and signup screens include **Continue with Google**. The button uses Supabase OAuth and the same authenticated app/onboarding flow as email accounts. A Google account signs in without requesting a Supabase confirmation email.

- Google OAuth client type: Web application.
- Authorized JavaScript origin: `https://yapspace.lol`.
- Google redirect URI: `https://qcmirozomkxradixsuqt.supabase.co/auth/v1/callback`.
- Supabase Site URL and allowed redirect: `https://yapspace.lol/`.
- Vercel Production `VITE_APP_URL`: `https://yapspace.lol`.
- Client ID and secret belong in Supabase's Google provider settings. The client secret must never appear in frontend code or VITE variables.
- Google consent-screen audience must allow the intended users. A Google app left in Testing mode may restrict sign-in to designated test users; configure production publishing in Google Auth Platform when ready.

On 26 October 2026, the live public Auth settings reported Google enabled and the authorization endpoint returned HTTP 302 to `accounts.google.com` with the expected Supabase callback. The full account-selection, Google consent and authenticated return require a real user/browser check. No account or Google permission was granted by these automated checks.

Profile edits retain the existing server-side current-password verification on every save. Google-only users must first set a YapSpace password using the password-reset flow. This still requires functioning SMTP. Google sign-in does not remove the SMTP requirement for email/password signup and recovery. No weaker profile-write route was added.

Reference: https://supabase.com/docs/guides/auth/social-sign-in/auth-google
