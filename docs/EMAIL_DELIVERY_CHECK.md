# Email delivery check — 2026-10-26

## Verified

- Frontend signup uses Supabase `signUp` with `emailRedirectTo`; password recovery uses `resetPasswordForEmail` with `redirectTo`. Both resolve through the canonical production URL helper. No email-sending loop was found in these forms.
- Auth logs from the last 24 hours include an `over_email_send_rate_limit` / HTTP 429 signup at 2026-10-25 17:07:44 UTC.
- The latest explicit `mail.send` records found were confirmation at 23:08:30 UTC and recovery at 23:11:32 UTC on October 25, using `noreply@mail.app.supabase.io`. These indicate a send event, not inbox placement.
- A signup at October 26 02:32:16 UTC is `user_repeated_signup`, HTTP 200. It is not evidence of a new confirmation email.
- Requests at 02:35:09 and 02:38:45 UTC are recovery actions through `/magiclink`, HTTP 200. No matching explicit `mail.send` event was found. Request success alone does not prove recipient delivery.
- Reload logs show email rate-limit changes from `2/1h` to `30` at 02:24:40 UTC, then to `60` at 02:34:06 UTC. This does not identify the current SMTP provider or prove its credentials/domain verification work.
- Public DNS via Google DNS-over-HTTPS: `resend._domainkey.yapspace.lol` has a DKIM public key; `_dmarc.yapspace.lol` has `v=DMARC1; p=none;`; `send.yapspace.lol` is a CNAME to `send.forge.rmta.net` with SPF and MX answers on that target. Compare these with the exact records in the configured provider; do not replace them based only on an assumed provider layout.

## Remaining checks

The connected Supabase tools do not expose Auth SMTP configuration, and there is no connected email-provider delivery-log tool. Current provider, sender verification, SMTP authentication and recipient delivery/bounce/suppression status remain unverified.

1. In Supabase Authentication → Emails → SMTP Settings, check whether custom SMTP is enabled and which host/sender it uses.
2. If using Resend, confirm the domain status is Verified and compare all required DNS values with the current Domains page.
3. Resend SMTP uses host `smtp.resend.com`, port `465` (implicit TLS) or `587` (STARTTLS), username `resend`, and a sending API key as the SMTP password. Enter secrets directly in the dashboard. Use YapSpace as sender name and a sender at the verified domain.
4. Inspect the provider's Emails log for a missing message: accepted/delivered, bounced, suppressed or rejected. A delivered event can still result in spam placement.
5. After configuration is verified, request a single fresh email for an operator-controlled test address and verify the message plus its action link. No outbound test emails were sent during this diagnostic.

The branded HTML files are separate from SMTP delivery setup. They do not increase sending limits or verify a sender.

Sources:
- https://supabase.com/docs/guides/auth/auth-smtp
- https://resend.com/docs/send-with-smtp
- https://resend.com/docs/dashboard/domains/introduction
