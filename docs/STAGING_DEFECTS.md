# Staging defects and observations

The browser run found the defects D1 to D3 below (fixed), a security-header decision (D4), and one open item (D5).

## Defects

| # | Severity | Item | Steps to reproduce | Status |
| --- | --- | --- | --- | --- |
| D1 | High | Agency checkout page crashed: the plan's `aiMonthlyBudgetSgd` (a Prisma Decimal) was passed to a client component ("Decimal objects are not supported"). Any plan with an AI budget, which the production catalog sets for Gold and Platinum, broke `/agency/billing/checkout`. | Log in as an agency, open `/agency/billing/checkout` | Fixed in `app/(agency)/agency/billing/checkout/page.tsx` (converted to a number). |
| D2 | High | `middleware.ts` only allowed `/admin` paths for ADMIN/STAFF, so every `/api/admin/*` call from a logged-in admin was redirected to `/login`. Admin tools that save data (prospects, founding grants, and likely payments and plans) could not work in a browser. | Log in as admin, `POST /api/admin/prospects` | Fixed with a coarse ADMIN/STAFF gate for `/api/admin/*`. All 17 admin routes already enforce their own permission and MFA check. **Please review: this is access-control code.** |
| D3 | Medium | Development CSP blocked `eval()` and the `127.0.0.1` origin, so no page hydrated under `next dev`. Production CSP is unchanged. | Load any form under `next dev` | Fixed in `next.config.ts` (dev-only `unsafe-eval`, `allowedDevOrigins`). |
| D4 | Medium | The Content-Security-Policy blocks the Google Fonts stylesheet (`style-src` has no `fonts.googleapis.com`), so the site fonts do not load. | Open any page, check the browser console | Open: your decision, because it is a security header. Self-host the fonts or allow the domain. |
| D5 | Open | `e2e/ai-chat-lead.spec.ts` stalls at the chat's agency selector (it never lists the test agency), so scenarios 2 and 3 are unverified in a browser. Not yet known whether this is test data, ranking or a chat bug. | Run the spec with `E2E_STAGING=1` | Open: needs investigation. |
| D6 | Info | The existing e2e specs were stale against recent hardening and UI changes (no driver adapter, short verification tokens, missing `Origin` header, renamed labels and buttons). | n/a | Specs updated; no product change needed. |

## Earlier observations

| # | Severity | Item | Steps to reproduce | Status |
| --- | --- | --- | --- | --- |
| 1 | Low | Storage policies from `supabase/staging-setup.sql` are not in the database (`pg_policies` has 0 rows for `storage.objects`). Access is still denied to anon and signed-in client roles because RLS is on with no permissive policy, and uploads, signed URLs and public media reads all behave correctly. | `scripts/verify-staging-storage.ts` | Open: owner to confirm the SQL was run as generated. No ad-hoc policies were added. |
| 2 | Info | The 48-hour slow-response threshold in `docs/DECISIONS.md` is not implemented in code. Only the 24-hour on-time share exists. | Search `lib/leads` | Not a bug; a product decision. Not built, per the "no new features" rule. |
| 3 | Info | The 24-hour on-time share is calculated over all leads, so unanswered leads count against it. | `lib/leads/response-metrics.ts` | Confirm this is the intended definition. |
| 4 | Info | The staging seed sets the `Basic Free` plan's lead limit to 2 in the staging database only. | `prisma/seed-staging.ts` | By design for the dry run. |
| 5 | Info | The service role key and the database password were pasted into chat. Both must be rotated before the staging project is used for anything real. | n/a | Open: owner action. |
