# Existing-account sign-in guard

The application previously marked profile loading as finished when a lookup threw, but did not set the failure flag. A null profile then opened onboarding. A successful empty lookup also opened onboarding without distinguishing a different signed-in identity from an explicitly new account.

The fix separates loading, retryable failure, an existing profile, a missing profile and explicitly requested setup. Errors show Retry/Sign out. A missing profile explains that the sign-in identity has no YapSpace profile and offers sign-out/retry before an explicit **I’m new — create a profile** action. Existing profiles go directly into the account.

Profile reads and setup capture the current account's bearer token, bind the request to that token, and reject identity changes before/after the operation. The app also ignores stale onboarding results after an account switch. Profile loading uses the database's RLS-protected request to verify access; cached session reads avoid the previously redundant Auth getUser network request on every profile load.

Local regression checks cover lookup failures, missing rows, existing profiles, stale account results, setup authorization staying with one identity, and captured tokens. The embedded PostgreSQL suite checks that repeated setup preserves the original profile, conversation and persisted message. No production account data was read, recovered, merged or changed to diagnose this report.

This prevents the confirmed error-to-onboarding bug; it does not prove which sign-in identity was used in the reported incident. Email and Google identities are not manually linked by matching names, handles or email strings. Supabase's verified identity handling remains authoritative. No account recovery was attempted.
