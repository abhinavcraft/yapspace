# YapSpace

A calm, responsive one-to-one messaging app. React + TypeScript + Vite, backed by Supabase Auth, PostgreSQL, and private Realtime Broadcast.

## Run locally

Requires Node.js 22 or later.

```sh
npm ci
npm run dev
```

Without Supabase environment variables, YapSpace opens a clearly labeled demo. The demo uses sample people and browser-local storage; it sends nothing to real people. Reset it from Settings. Demo data is stored separately from live data, and live message history is not cached in localStorage.

## Connect Supabase

1. Create a dedicated development Supabase project. Use an empty project; the migration is a new schema, not an upgrade of another app.
2. Run `supabase/migrations/202610250001_yapspace.sql` through the SQL Editor or your normal migration process. This migration intentionally uses restricted SECURITY DEFINER RPCs; see `docs/architecture.md` for their authority boundaries.
3. In Realtime settings, **disable Allow public access**. The migration installs the topic-specific receive policy. Do not add permissive policies to `realtime.messages` or permit client broadcasting.
4. Enable email/password Auth. Configure email confirmation and SMTP delivery for your environment. Set the Site URL and allowed redirect URLs to the development and deployed origins you use.
5. Copy `.env.example` to `.env.local` and fill in **only** the project URL and publishable key:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_public_key
```

6. Restart the dev server, or rebuild and redeploy. These are Vite build-time values. Never put secret/service-role keys in `VITE_*` variables. No admin key is needed by this app.
7. Sign up with two test accounts in separate browsers, confirm their emails, choose their handles, then find one account by handle from the other.
8. Complete the real-service acceptance checks in `docs/verification.md` before allowing real users or claiming production security.

## Checks

```sh
npm test
npm run test:db
npm run build
```

The database test executes the actual migration in PGlite (embedded PostgreSQL), with test Auth and Realtime scaffolding. It tests SQL grants, RLS, RPCs, rate limits, and idempotency. It does **not** prove hosted Supabase authentication, email delivery, WebSocket authorization/delivery, or concurrent transactions across separate PostgreSQL connections.

## Scope

- Email/password sign-up, sign-in, session restoration, onboarding, and sign-out.
- Authenticated, prefix-based directory with public display names and handles only.
- One canonical conversation per unordered pair; no self-chat.
- Ordered paginated history, pending/sent/unconfirmed states, retries using the same idempotency key.
- Private database-originated events and database catch-up on subscribe, reconnect, focus, and periodic repair.
- Own unread cursor; no peer read receipts or online-presence claims.
- Responsive layout, keyboard controls, emoji entry, local conversation search, and useful empty/error states.

No groups, attachments, calling, message edits/deletes, or E2EE. Database administrators can read stored messages. Real messages require a connected and configured Supabase project.

See `docs/architecture.md` for security and consistency design and `docs/verification.md` for verification boundaries and remaining deployment work.
