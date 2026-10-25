# Verification and deployment gates

Real Supabase integration is NOT RUN: the user chose to connect a project later. Demo interaction is not evidence of secure cross-account messaging.

## Executed on 2026-10-25

- `npm test`: 11 of 11 tests passed with Vitest 5.0.5.
- `npm run test:db`: 35 of 35 checks passed in embedded PostgreSQL.
- `npm run build`: TypeScript and production Vite build passed.
- Dependency audit after the test-tooling update: 0 known vulnerabilities reported by npm.
- Browser interaction checks passed: opening a thread, sending a demo message and seeing its saved status, seeing that message after reload, directory search and starting a new chat, emoji insertion, conversation filtering, resetting demo data, and navigating to sign-in.
- The available browser viewport was approximately 714 × 615 and exercised the narrow-screen layout. The requested viewport override did not take effect; a separate full-width desktop browser check and formal automated accessibility audit were not completed.

The hosted demo contains no Supabase configuration or real user messages. Build and SQL check output was observed directly; CI is supplied but its hosted execution has not been observed.

## Automated local checks

Run `npm test`, `npm run test:db`, and `npm run build`. The SQL runner prints each check and fails immediately on assertion failure. It executes the real migration against embedded PostgreSQL with fixture auth.uid(), realtime.topic(), and realtime.send(). These fixture services are not Supabase Auth or a WebSocket server.

## Required live acceptance checks after setup

1. In a dedicated test project, apply the migration from a clean database. Confirm every app table has RLS, no permissive existing policies override it, and public Realtime access is disabled.
2. Create confirmed A, B, and C accounts. Sign in using separate browser profiles. A searches B and starts a conversation. B can fetch the conversation. A and B racing to start it produce one pair row.
3. A sends text; B receives it. Reload both browsers and confirm history and ordering. Send concurrently in both browsers and validate unique, increasing sequence order with no duplicate idempotency key rows.
4. Copy A/B's conversation UUID into C's authenticated raw REST/RPC calls. Verify C receives no conversation/messages and cannot send or advance read cursors. Attempt a private channel join using that topic; verify subscription rejection. Repeat as anonymous.
5. Retry one send with the same client_message_id, body, and conversation. Confirm one persisted row and one sequence allocation. Change body or conversation with the same key and verify conflict. Test from independent connections.
6. Disconnect B's WebSocket while leaving REST available, then send from A. Resume and verify catch-up with no duplicates. Send during the fetch/subscribe boundary. Test more than 100 missed messages and more than 50 historical messages.
7. Hide or blur B, send from A, and verify unread stays unread until B focuses and views the bottom. Lower read cursors cannot roll back, and out-of-bounds cursors clamp. Test another browser for B.
8. Sign out while reads/sends are in flight; verify the old UI clears and the old channel stops. Sign in as C; no A/B content may reappear. Exercise token expiration and refresh.
9. Use only the keyboard to sign in, search, open dialogs, send, retry, and return to the inbox on mobile. Check reduced motion and 200% zoom. Review contrast and focus with an accessibility tool.
10. Verify production HTTPS, auth redirect allowlist, SMTP, backups/restore, no secret keys in built output, and suitable abuse protection. Make an explicit operational retention/deletion decision before real user data.

## Not claimed

No measured latency or availability guarantee. No E2EE. No executed hosted three-account test, real WebSocket test, production load test, backup restoration, or multi-connection concurrency test until the project is connected and the corresponding checks are run.
