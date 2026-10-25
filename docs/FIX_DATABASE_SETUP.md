# Fix the missing complete_profile function

The configured Supabase project was checked on 2026-10-25. Both `complete_profile` and `list_conversations` returned `PGRST202` (function missing). Changing the order of arguments in the frontend will not fix missing database functions: PostgREST matches these arguments by name.

1. Open **your connected Supabase project → SQL Editor → New query**.
2. Copy the entire contents of `supabase/setup.sql`, paste it into that query, and press **Run**.
3. Wait a few seconds. The file sends `NOTIFY pgrst, 'reload schema'` to refresh the API cache.
4. Run `npm run check:setup` locally. Each core function should report **installed, anonymous execution denied**. This command uses only the public key and does not create users or messages.
5. Return to YapSpace and retry profile creation.

The setup file is re-runnable and preserves existing rows. It installs the app tables, narrow RPCs, grants, RLS, private receive policy, profile editor fields, and server-only update primitive. It replaces only YapSpace-named policies and functions. Use a dedicated YapSpace project; incompatible pre-existing table definitions cause the transaction to fail rather than silently change unrelated schemas. Do not delete tables or disable RLS to resolve an error.

To inspect the signatures in SQL Editor:

```sql
select p.proname, p.proargnames
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('complete_profile', 'list_conversations');
```

Expected: `complete_profile` has arguments `p_handle, p_display_name`, and `list_conversations` has no input arguments.

## Enable password-protected editing

The database deliberately rejects direct client profile edits. The included `update-profile` Edge Function authenticates the caller, verifies their current password through Supabase Auth on **every request**, checks that both identities match, and only then writes the profile. Deploy it after database setup:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy update-profile
```

Supabase supplies the Edge Function's URL, anon key, and server-only service-role key. Never put a service-role key into a Vite variable or browser. The function's gateway JWT check is disabled in `supabase/config.toml` because the handler validates the JWT explicitly with `auth.getUser`, including projects using current signing keys. The handler rejects missing or invalid JWTs and wrong passwords. Deploy the function and config together.

Hosted password verification and the function deployment were not executed in this session because project administration access was unavailable. Windows browser automation stopped when it could not verify the browser URL. The SQL repair, update handler, and their security checks were verified locally.

## Latest deployment status

The core functions are now installed in the connected project. The production hardening and advisor migrations have been applied, and update-profile is deployed ACTIVE. Seventeen live PostgreSQL role checks passed with all fixtures rolled back; the unauthenticated Edge endpoint correctly returns 401. The earlier browser-access limitation no longer blocks these operations because the Supabase integration is connected. See docs/PRODUCTION_READINESS.md for remaining SMTP/staging/backup gates and the separate pending migration-history review.
