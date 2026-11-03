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

## Browser run (Playwright on a separate staging server, port 3100)

Final full run: **7 of 8 tests pass**; 1 fails (`e2e/ai-chat-lead.spec.ts`). Output: `playwright-full.txt`.

| Test | Result | Covers scenario |
| --- | --- | --- |
| agency registration, onboarding, approval, mock checkout, featured listing | PASS | 7 (mock checkout), 9 (register, submit, approve, public listing) |
| prospect links to free listing, founding grant expires and downgrades without charge | PASS | 5 (prospect tracker, audit), 6 (founding expiry, via real admin UI and API) |
| register, verify email, log in | PASS | auth |
| seeded agency profile enquiry flow (with Turnstile) | PASS | 1 (enquiry as visitor) |
| directory browse and role redirects; registration roles; smoke and policies | PASS | 8 (visitor redirects) |
| visitor chat to consented enquiry, attribution, agency reply | FAIL | 2, 3 (stalls waiting for the agency to appear in the chat's agency selector) |

Scenarios 2 and 3 therefore remain unverified in a browser. Scenarios 4, 8 and 10 remain partial and 7's bank-transfer path and payment-proof upload were not exercised.

## Full validation

| Check | Result | File |
| --- | --- | --- |
| `tsc --noEmit` | PASS | `tsc.txt` |
| Lint | PASS: 0 errors, 4 warnings | `lint.txt` |
| Unit tests | PASS: 15 files, 59 tests | `unit-tests.txt` |
| AI evals | PASS: 30/30 | `ai-evals.txt` |
| Build | NOT RUN | would write to `.next` beside the running dev server |
| Playwright suite | 7 of 8 pass | `playwright-full.txt` |
| Staging database | PASS: 32 tables + `_prisma_migrations`, none missing, RLS on for all, vector column, HNSW index, 9 migrations applied | `scripts/verify-staging-db.ts` |
| Staging storage | PASS: 15/15 (buckets, limits, signed URL, public read, test files deleted) | `scripts/verify-staging-storage.ts` |
