# YapSpace architecture

## Observed starting state and choices

The workspace was empty, with no Git repository, original PRD.md, manifests, existing schema, tests, CI, or production data. Node v24.21.0 and npm v12.2.0 were available. The provided proposed PRD was read as product input; its embedded agent kickoff/approval prompts were not treated as the user's action request. The user explicitly requested implementation and subsequently chose to connect Supabase later.

React/TypeScript/Vite is a static client with a small Supabase adapter. Next.js was a provisional suggestion in the supplied PRD. No app server is necessary for this MVP: PostgreSQL is the trusted write boundary, and authorization uses user JWTs. This avoids requiring server credentials. Versions are pinned by package-lock.json. Source is under src/, schema under supabase/migrations/, executable SQL checks under scripts/.

## Schema and privilege boundaries

- profiles: public display name and normalized handle only; no email. Self and existing peers can select profile rows. A separate authenticated search RPC returns at most 20 literal-prefix results after two characters. Authenticated users may start conversations with discovered users. This is not invitation-only discovery.
- conversations: sorted participant UUID pair, unique pair constraint, transactional next_seq, last activity. Participants cannot be changed by clients.
- messages: canonical server id, actor-derived sender, per-conversation seq, body, per-sender idempotency key, server timestamp. No client updates/deletes.
- conversation_reads: one actor-owned monotonic cursor. Only its owner can read it. Counts exclude their own sent messages.

RLS is enabled on every exposed app table. Anonymous access and direct client mutations are revoked. SECURITY INVOKER list_conversations respects the caller's RLS. Narrow SECURITY DEFINER RPCs implement writes because direct table writes are deliberately forbidden; each fixes search_path to empty, schema-qualifies access, binds auth.uid(), validates inputs, checks membership, and has PUBLIC/anon EXECUTE revoked. Profile registration can only create the actor's profile; directory exposes only explicitly public fields. The trigger function has no client execution grant.

Foreign keys to messages and conversations restrict deletion to prevent accidental history loss. Removing an Auth account with conversations will be restricted; retention and an explicit reviewed deletion/export workflow must be established before production.

## Consistency

Sending obtains a transaction-scoped actor advisory lock, then locks the conversation row. A retry checks the per-sender key and returns the original message only if both chat and body match. The sequence counter, inserted message, last activity, and minimal notification share one transaction. Failed transactions roll back all of them. Per-actor locking also serializes rate checks; new sends are limited to 60 per minute and new conversations to 20 per minute. A saved retry remains available after a rate limit is reached.

Clients reconcile by sender/client_message_id, display canonical rows in sequence order, and keep pending rows distinct until acknowledgment. Timeouts show unconfirmed state with a same-key retry. Message bodies render as React text, never HTML. Confirmed status does not mean read by the other person.

The initial latest page establishes a fetched window. The client creates a private conversation:<UUID> subscription and then catches up from the database after subscription acknowledgment. Catch-up pages use ascending seq greater than the last fetched cursor (100 per page); the cursor advances only from ordered database reads, never a notification payload. Older pagination uses seq less than the oldest row. Broadcasts contain identifiers only; they trigger an authorized re-fetch. Reconnect/focus/visibility/online and periodic polling repair lost events. The inbox polls for new conversations and unread state. Only the active conversation owns a channel, bounding subscriptions.

Read advancement happens only while the document is visible, focused, and at the bottom of the current timeline. Server cursors are clamped to committed sequence and never decrease. Inbox latest previews always come from canonical stored messages.

## Session and transport

Supabase JS owns browser token persistence and refresh. No cookie-authenticated custom mutation endpoint exists; RPC requests use bearer tokens. Auth changes clear private UI caches and detach channels. Tokens and message bodies are not logged. Live message data is in memory, not a durable offline outbox. Demo data lives in its own localStorage namespace and cannot be migrated into real conversations.

Realtime receives only topic-specific SELECT authorization, with no permissive INSERT policy. Public channel access must additionally be disabled in Supabase settings. SQL simulation tests do not prove actual WebSocket enforcement: verify with three real accounts before production.

## Threats and operational boundaries

IDOR, guessed UUID writes, forged sender/sequence, direct table mutations, idempotency collisions, foreign read cursors, and outsider topic reads are tested in embedded PostgreSQL. The app never advertises E2EE. Admins with database access can read content. Transport security depends on HTTPS and the Supabase deployment.

Before production: verify hosted RLS/Realtime, separate-connection races, sign-out/token refresh, email delivery, backup/restore, retention/deletion, rate-limit load behavior, monitoring/redaction, and data residency. Database rate limits do not replace upstream abuse protection. The directory is authenticated and bounded but not an anti-scraping system. Add edge rate limits/CAPTCHA appropriate to actual traffic. The inbox currently loads the user's conversation list in one query; very large inboxes need cursor pagination and query-plan/load validation.

## Official implementation references

- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/realtime/authorization
- https://supabase.com/docs/guides/realtime/broadcast

The current authorization guidance explicitly warns against altering ownership-managed realtime.messages RLS; the migration creates the receive policy without that ALTER TABLE operation.
