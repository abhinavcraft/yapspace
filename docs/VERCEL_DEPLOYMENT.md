# Vercel and yapspace.lol

## Current deployment — 25 October 2026

- Team: `agnivya` (`team_AJOnFjyqAHtVlOb5LI6ixOiS`).
- Project: `yapspace` (`prj_5Pk4lNLn2Aw9OUinjzXHmRM6ldjf`).
- Production deployment: `dpl_ESyvY1ZjwH9wgqKbqiuAgVXy34Re`, status **READY**.
- Stable URL: https://yapspace-agnivya.vercel.app (Vercel Authentication remains enabled on Vercel-hosted aliases).
- Immutable URL: https://yapspace-1rk9f131b-agnivya.vercel.app.
- Shipped the tested static Vite output through Vercel's file-deployment API, with explicit no-build settings for this artifact. The source configuration below supports future source builds. No Git integration is connected to Vercel yet.
- Unit tests: 45 passed. Embedded PostgreSQL checks: 45 passed. Live HTML, JavaScript asset caching, CSP, nosniff, no-referrer and static health endpoint passed through the authenticated Vercel fetch tool. Full browser/Auth/message acceptance remains pending.
- Supabase profile function version 3 is ACTIVE. Its default origin list includes the custom domain, exact stable Vercel aliases and the existing Site; current JWT/password checks remain in place. Live preflight accepted the custom domain and rejected an unrelated origin. Anonymous function/RPC access checks passed.
- `yapspace.lol` is attached and ownership-verified, but Vercel still reports DNS misconfigured: authoritative Spaceship DNS serves the previous A records. Set apex `@` A values to the current Vercel recommendation: `216.198.79.1` and `64.29.17.1`. Preserve unrelated MX/TXT records. Recheck DNS and HTTPS after the change.
- Verification/reset email templates are prepared locally, but have **not** been applied to live Supabase Auth. Dashboard sign-in and email provider/domain verification remain required. Browser control was stopped by the user; no further browser actions were taken in that turn.
- Public Supabase URL/publishable key are configured for Vercel Production builds only. The current static artifact already includes those public settings. `VITE_APP_URL` is intentionally not pinned until custom-domain HTTPS is ready; the current build uses the page origin for callbacks. Site URL/redirect allowlist still require the Supabase cutover described below.


The Vite app can be deployed directly to Vercel. Supabase continues to own Auth, Postgres, Realtime and the password-verifying profile function. The existing Sites Worker build remains available separately.

## Build

- Framework: Vite; Node 22 or 24.
- Install: `npm ci`.
- Build: `npm run build:vercel`.
- Output: `.site-build/client`.
- Production environment: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (public key only).
- Set `VITE_APP_URL=https://yapspace.lol` only when the domain serves the deployment over HTTPS. Without this setting callbacks use the current app origin. Rebuild after changing a VITE variable.
- `vercel.json` applies security headers and hashed asset caching. Its CSP must match the configured Supabase project; the build checks this.
- No service-role key, SMTP password, database password or Supabase management token belongs in Vercel's frontend environment.

## Domain cutover

1. Add `yapspace.lol` to the Vercel project. Use the DNS values returned for that project, rather than guessed shared IP addresses.
2. Wait for domain verification and a valid HTTPS certificate. Optionally add `www.yapspace.lol` with a permanent redirect to the apex domain.
3. In Supabase Auth → URL Configuration, set Site URL to `https://yapspace.lol/`. Add exactly `https://yapspace.lol/` to Redirect URLs. Keep the current deployed Site callback during transition. Add only an exact stable Vercel callback if temporarily needed; do not allow every `*.vercel.app` project.
4. Set Vercel Production `VITE_APP_URL=https://yapspace.lol` and redeploy. This pins signup and recovery callbacks to the canonical production domain.
5. Ensure the Supabase `update-profile` function allows `https://yapspace.lol` in `YAPSPACE_ALLOWED_ORIGINS` if the secret is set. Its source default includes this domain and the existing Site. Redeploy that function when changing its default.
6. Request fresh verification and password-reset emails using your own test account. Old emails retain old links. Confirm the full email → confirmation → app session flow, password reset, private messaging and password-protected profile update before public launch.

## YapSpace email branding

Prepared HTML templates are in `supabase/email-templates`. Confirmation subject: **Confirm your YapSpace email**. Recovery subject: **Reset your YapSpace password**. Keep `{{ .ConfirmationURL }}` as the action link: it carries Supabase's verification token and respects Auth URL settings. The action must not link directly to the homepage. Footer links use `https://yapspace.lol`.

Apply these through Supabase Auth → Emails. For a sender such as `hello@yapspace.lol`, configure a custom SMTP provider, verify domain ownership and its DNS records (SPF/DKIM and a suitable DMARC policy), then set sender name **YapSpace**. Do not invent SMTP credentials or claim the address works before verification. DNS ownership and provider setup remain operator steps until supplied.

## Verification and rollback

Run `npm test`, `npm run test:db`, `npm run build:vercel`, then verify live HTTP security headers, HTML, assets and `/health.json`. The health response covers static assets only. Run the separate staging acceptance suite for actual multi-user Auth, Realtime and password verification.

Keep the last working deployment for rollback. A frontend rollback does not change Supabase's Site URL, redirect allowlist or CORS origins; restore those explicitly only if cutting back to the old origin. Do not reset the database or rewrite migration history during hosting migration. Remaining production gates are documented in `PRODUCTION_READINESS.md`.
