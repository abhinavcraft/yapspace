# Production readiness — current release

**Status: application hardened; live release gates still open.** Do not treat local tests or a deployed frontend as proof that the complete service is production ready.

## Verified in this session

- The configured live project exposes all six core messaging RPCs and denies anonymous execution.
- Dependency audit: zero known vulnerabilities reported after installation.
- 34 unit checks pass, covering reconciliation, input bounds, production configuration, password verification, origin checks, request size limits, and rate-limit refusal.
- 45 embedded PostgreSQL checks pass, including RLS/grants, idempotency, ordering, private-topic row authorization, read cursors, password-write isolation, server verification limits, and message persistence during notification failure.
- Live PostgreSQL: 17 role-isolation assertions passed, with all fixtures rolled back and original application row counts unchanged. Anonymous private WebSocket subscription was rejected.
- The production hardening migration and advisor privilege migration were applied. The password-protected profile Edge Function is deployed ACTIVE; its unauthenticated endpoint returns 401, and the server limiter is installed and unavailable to anonymous callers.
- Production build validates public configuration, scans output for privileged keys, packages security headers, restricts connections to the configured project, and emits /health.json for static asset monitoring.
- Fonts are bundled locally. Auth recovery, request timeouts, render recovery, and session-change guards are implemented.

## Live deployment results and remaining gates

The initially missing limiter and HTTP-404 profile function were fixed after the Supabase connection was established. Both new migrations are recorded and the function is ACTIVE. The live endpoint and SQL-role checks pass. The first real WebSocket connection initialized the provider-managed daily Realtime partitions; no manual changes to the Realtime schema were made. See the [official Realtime initialization explanation](https://supabase.com/kb/troubleshooting/realtime-warn-sending-broadcast-message).

1. DONE: production hardening and advisor-grant migrations are applied. For fresh projects, replay all versioned migrations. For this manually bootstrapped project, migration history reconciliation remains explicitly pending approval; see `MIGRATION_HISTORY_REVIEW.md`. Do not blindly replay the baseline SQL.
2. DONE: `update-profile` was deployed through the connected Supabase integration with explicit server-side JWT/password checks. Future updates can use the same integration or the linked CLI. Confirm `YAPSPACE_ALLOWED_ORIGINS` contains the deployed app origin (comma separated when needed). The default allows only the existing YapSpace Site origin. Add localhost explicitly only in development.
3. Disable **Allow public access** in Realtime settings, and review all existing policies for broad permissive overrides. The app subscribes with private:true. Verify with a real outsider, not just anonymous HTTP checks.
4. Configure custom SMTP, verified sender domain, email confirmation, production Site URL, exact auth redirect allowlist, password policy, email/token rate limits, and suitable signup bot protection. Credentials and mailbox/domain ownership must come from the operator. Do not enable a CAPTCHA setting without integrating its token into the relevant auth forms/password-verification flow.
5. Run the live acceptance suite against a separate staging project with three confirmed disposable accounts. Use `docs/test-accounts.env.example` → ignored `.env.acceptance.local`, then `npm run test:live`. The runner refuses the configured production project. It creates test conversations/messages but no accounts or outbound emails. Authenticated WebSocket and real password-function results remain NOT RUN until these credentials/project exist.
6. Execute the real PostgreSQL CI job. The local environment has no PostgreSQL server or Docker; independent-connection concurrency checks are supplied but NOT RUN locally. The runner only accepts an empty loopback database named yapspace_test and refuses nonempty or remote databases.
7. The static host was found to ignore _headers. Hosting now uses a small Worker with embedded assets that sets security headers itself. The built Worker passed local HTTP checks; verify its deployed responses with `scripts/check-live.mjs`. /health.json checks static availability only; monitor Supabase and synthetic sign-in/messaging separately.
8. Make and test a backup/restore in staging. Decide retention/deletion/export obligations, acceptable downtime/data loss, monitoring ownership, incident contact, and capacity. These require product/operational decisions; none were invented or marked complete.

The Site remains owner-private. Inviting other people or changing its audience requires an explicit sharing decision. No load, SMTP deliverability, backup restoration, formal accessibility certification, or production SLO is claimed.

## Release and rollback

Before release, run `npm run verify`, `npm audit --audit-level=moderate`, and `npm run check:setup`. Run live staging and PostgreSQL concurrency gates, then deploy the exact built archive from the source commit. Retain the prior Site version for rollback. Do not roll back database migrations by dropping tables; the new migration is additive and compatible with the previous frontend. If reverting the profile function, retain its password verification and deny direct client writes.

Keep backups encrypted and access restricted. Restore only into a separate project, replay migrations, run acceptance checks, and then plan a cutover. Never reset the production database for a deployment. Supabase administrative credentials must stay in its function environment/CI secret storage; no admin key belongs in VITE variables.

For outages, first distinguish frontend availability, Auth/SMTP, Postgres, and Realtime. Realtime failure is repaired by database polling/catch-up; notification failures no longer roll back saved messages. Do not disable RLS or broaden topic policies as an outage workaround. Log operational codes without passwords, JWTs, emails, or message bodies. Browser render recovery intentionally omits private state from logs.

## Size and abuse limits

Messages: 4,000 Unicode characters, 60 new messages/minute/actor. New conversations: 20/minute/actor. Profile password verification: five attempts per five-minute window/actor, stored atomically server-side and not resettable by clients. Requests: 8 KiB maximum JSON body, restricted origin, authenticated JWT, current-password verification. Auth email/password rate limits remain Supabase configuration. The current inbox loads the actor's conversation list in one query; very large inboxes require pagination and query-plan/load evidence before raising supported scale.

## Current security-advisor review

The unintended anonymous/signed-in execution grants on the project DDL helper were revoked. Five authenticated SECURITY DEFINER RPC warnings remain intentional: these narrow functions bind auth.uid(), validate membership/input, fix search_path, and deny direct table writes. The five app RPCs are not callable anonymously. The limiter table intentionally has no client RLS policy and no client grants; its advisor INFO notice describes a fail-closed, server-only table.

Leaked-password protection is still disabled in Supabase Auth and requires an operator setting/plan decision. See [the advisor remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Relevant definer-function review guidance: [Supabase database advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). No claim is made that every advisor notice is cleared.

Browser checks passed at 1280 × 720 for desktop and approximately 676 px wide for the narrow layout. Checks included recovery-screen navigation, wrong demo password refusal, successful demo profile save, password clearing, a fresh password requirement for a second edit, persisted light/dark choice, and the mobile composer staying above bottom navigation. The exact production Worker loaded without browser errors and has no demo button. Email recovery delivery and a real account’s successful password-protected save still need the staging acceptance run.
