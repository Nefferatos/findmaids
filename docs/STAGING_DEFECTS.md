# Staging defects and observations

No confirmed bugs in the built features have been found so far. Browser scenarios have not run, so this list is incomplete.

| # | Severity | Item | Steps to reproduce | Status |
| --- | --- | --- | --- | --- |
| 1 | Low | Storage policies from `supabase/staging-setup.sql` are not in the database (`pg_policies` has 0 rows for `storage.objects`). Access is still denied to anon and signed-in client roles because RLS is on with no permissive policy, and uploads, signed URLs and public media reads all behave correctly. | `scripts/verify-staging-storage.ts` | Open: owner to confirm the SQL was run as generated. No ad-hoc policies were added. |
| 2 | Info | The 48-hour slow-response threshold in `docs/DECISIONS.md` is not implemented in code. Only the 24-hour on-time share exists. | Search `lib/leads` | Not a bug; a product decision. Not built, per the "no new features" rule. |
| 3 | Info | The 24-hour on-time share is calculated over all leads, so unanswered leads count against it. | `lib/leads/response-metrics.ts` | Confirm this is the intended definition. |
| 4 | Info | The staging seed sets the `Basic Free` plan's lead limit to 2 in the staging database only. | `prisma/seed-staging.ts` | By design for the dry run. |
| 5 | Info | The service role key and the database password were pasted into chat. Both must be rotated before the staging project is used for anything real. | n/a | Open: owner action. |
