# Staging manual checklist

Repeat in a browser against the staging server (see `docs/STAGING.md`). Use the fake accounts only. Password is `E2E_TEST_PASSWORD` in `.env` (profile B); admin also needs a TOTP code from `E2E_ADMIN_TOTP_SECRET`.

1. **Enquiry cap.** On `/agencies/test-agency-a` send 4 enquiries (use different emails). Each shows the success message, never an error. Log in as `agency-a@example.test`: all 4 are in the inbox, the upgrade prompt shows, and the count above the allowance of 2 is correct.
2. **Chat to enquiry.** Open the chat widget, accept consent, chat, create an enquiry. The conversation appears, the lead has a summary, and the admin source report counts chat open, message and enquiry.
3. **Attribution.** Visit `/?utm_source=facebook`, accept cookies, send an enquiry: "facebook" appears in the admin report and agency dashboard. Repeat with cookies declined: no source is stored.
4. **Response metrics.** As Agency A, reply to leads at different times. First-response time and the 24-hour share on the agency dashboard and admin report match your timings.
5. **Prospect tracker.** As admin move a `CONTACTED` prospect to `LISTED_FREE` and link it to an agency. `DO_NOT_CONTACT` blocks outreach actions. Audit log entries exist. CSV export and import work.
6. **Founding expiry.** Run `npx --no-install tsx scripts/staging-scenarios.ts`, then check Agency B is on Basic Free with no payment. Re-run `npx --no-install tsx prisma/seed-staging.ts` to restore it.
7. **Payments.** As Agency C complete mock checkout. Then submit a bank-transfer payment with a proof file and approve it as admin. Check subscription, invoice number and receipt.
8. **Permissions.** Agency A cannot open Agency B data. STAFF cannot open payments, plans or roles. Non-admins cannot open the prospect tracker.
9. **Approval flow.** Register a new agency, upload photos, submit. Admin requests changes, agency resubmits, admin approves. The agency appears in the public directory only after approval.
10. **Safety.** Chat replies in English only; a non-English message gets an English reply or handoff. The AI kill switch disables all AI at once. PII is masked in AI logs.
