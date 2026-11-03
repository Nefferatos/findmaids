# Staging dry run results

Run against the staging Supabase project (`tajpujqabclbxoggkxse`) with mock email, payments, AI and no WhatsApp. Nothing real was sent or charged.

Status key: PASS = verified with evidence; PARTIAL = only the logic or API level was verified; NOT RUN = needs the browser scenarios, which are blocked (see below).

| # | Scenario | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Enquiry delivery above the cap | PASS (API level) | `in-process-scenarios.json`: 4 enquiries to Agency A (limit 2) all returned 201 and were saved; allowance shows 2 over the limit, Gold offered as upgrade, nothing locked under `DELIVER_ALL`. The dashboard page itself was not viewed in a browser. |
| 2 | Chat to enquiry | NOT RUN | Needs a running server. `ai-evals.txt` (30/30) covers the mock assistant's classification only. |
| 3 | Attribution with and without consent | NOT RUN | Needs a browser. Source classification is covered by `tests/step7-policy.test.ts`. |
| 4 | Response metrics | PARTIAL | `in-process-scenarios.json`: average first response 18 h and 50% within 24 h are correct for a known sample. Agency dashboard and admin report were not viewed. |
| 5 | Prospect tracker | NOT RUN | Needs an admin session. The outreach block on `DO_NOT_CONTACT` is covered by `tests/step7-policy.test.ts`. CSV import/export and audit entries were not exercised. |
| 6 | Founding expiry | PASS | `in-process-scenarios.json`: real cron handler with the clock moved 5 days ahead. Agency B went Gold to Basic Free, no payment rows were added, the founding placement was cancelled, the audit entry exists, and A and C were unaffected. Founding emails are disabled, so no notice was sent or logged beyond the audit entry. Agency B was re-seeded afterwards. |
| 7 | Payments (mock checkout, bank transfer) | NOT RUN | Needs a browser and admin session. `tests/payments.test.ts` covers the payment domain. |
| 8 | Permissions | PARTIAL | `tests/admin-permissions.test.ts`: STAFF limited to approvals, reviews, leads and dashboard; AGENCY and VISITOR denied. Cross-agency reads over HTTP were not tested. |
| 9 | Approval flow | NOT RUN | Needs a browser. |
| 10 | Safety checks | PARTIAL | 30/30 AI evals (including Taglish and Tagalog cases), `tests/ai-kill-switch.test.ts`, and PII masking in `tests/ai-policy.test.ts` pass. Not tried live in the chat widget. |

## Why the browser scenarios did not run

A node dev server (PID 30048) holds port 3000 and the Next.js dev lock. It was not stopped, so no staging server could be started for Playwright. See `docs/STAGING.md` for the commands to run once it is stopped.

## Full validation

| Check | Result | File |
| --- | --- | --- |
| `tsc --noEmit` | PASS | `tsc.txt` |
| Lint | PASS: 0 errors, 4 warnings | `lint.txt` |
| Unit tests | PASS: 15 files, 59 tests | `unit-tests.txt` |
| AI evals | PASS: 30/30 | `ai-evals.txt` |
| Build | NOT RUN | would write to `.next` beside the running dev server |
| Playwright suite | NOT RUN | needs the staging server |
| Staging database | PASS: 32 tables + `_prisma_migrations`, none missing, RLS on for all, vector column, HNSW index, 9 migrations applied | `scripts/verify-staging-db.ts` |
| Staging storage | PASS: 15/15 (buckets, limits, signed URL, public read, test files deleted) | `scripts/verify-staging-storage.ts` |
