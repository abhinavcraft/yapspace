# Migration history review — approval pending

The project’s original tables, RPCs, constraints, RLS policies, and profile columns were installed manually through setup SQL. The migration-history table therefore did not contain their baseline records. This was observed before any new migration was applied.

The live schema was inspected, policies/grants were reviewed, and 17 transactional role-isolation assertions passed against the live PostgreSQL database. Every test fixture was rolled back; the original profile/message counts were unchanged.

These two **new** migrations were applied through the Supabase migration tool and are recorded normally:

- `20261025155628_production_hardening.sql`
- `20261025155915_advisor_privileges.sql`

The corresponding source filenames now match the server’s recorded versions. The two earlier manual baselines are preserved locally with valid timestamp filenames:

- `20261025000100_yapspace.sql`
- `20261025000200_profile_editor.sql`

An attempted history-only insertion of baseline records was rejected by automatic approval review because it could inaccurately mark migrations as applied without explicit authorization and create future deployment drift. **No baseline records were inserted, and the rejection was not bypassed.**

Proposed next step, requiring explicit approval: compare the baseline SQL with the live schema once more, then mark the two verified manual baselines as applied using the standard migration-history repair process. This would change deployment metadata only; it must not rerun the original CREATE TABLE statements or modify application rows. The risk is skipping required DDL if the recorded baseline does not actually match the database.

Until approved, do not run an unconditional `supabase db push` against this existing project. Review each future additive migration through the normal migration tool. New empty projects can replay the versioned SQL normally.
