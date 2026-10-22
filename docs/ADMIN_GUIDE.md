# FindMaids Admin Guide

## Access and roles

- `ADMIN` can access all admin sections and all financial, plan, user, report and settings actions.
- `STAFF` is limited to agency approvals, review moderation and lead moderation. STAFF cannot view payment details, change plans, roles, settings or audit history.
- Bootstrap the first ADMIN only after the initial account is registered and email-verified: apply the migrations, then set that account's `User.role` to `ADMIN` using a controlled database administration session. Never add a default admin password or promote an unverified account.
- AI demonstrations are disabled by default. In Settings, set the JSON `featureFlags` object, for example `{"employer_assistant":true,"agency_auto_reply":true,"agency_profile_helper":true}`. The assistant uses retrieved public directory facts and curated FAQs; agency reply and profile helpers create editable drafts only. They do not send messages or call an external model.
- Configure the Supabase `findmaids-media` bucket as public for approved agency listing images, and `findmaids-private` as private for bank proofs and invoice PDFs. Keep the service-role key server-only. Never make the private bucket public; all private object reads pass through authenticated ownership/admin checks.
- Configure a strong `AUTH_SECRET` and `NEXTAUTH_SECRET`. To require TOTP for an ADMIN, configure `TOTP_ENCRYPTION_KEY` as base64 for exactly 32 random bytes, sign in as that ADMIN, open `/admin/2fa`, scan the QR code and verify a current six-digit code. Once enabled, password login requires the code; Google OAuth is refused for TOTP-enabled ADMIN accounts.
- Account disablement is checked against the database on every JWT refresh and protected-route request.

## Agency approval checklist

1. Open `/admin/approvals`; the queue is oldest first. The SLA indicator turns on after 48 hours from submission.
2. Compare licence number, phone, email, and exact normalized name/address matches shown as duplicate candidates. These are signals, not proof of fraud.
3. Preview the same public profile data and media that a directory visitor would see.
4. Confirm all checklist items: licence verified, contact verified, content appropriate, and logo/photos reviewed.
5. Use **Approve** only when every checklist item is checked. The agency status becomes `APPROVED`, an audit record is saved, the owner is emailed, and Basic Free is activated.
6. Use **Request changes** with a clear note; status becomes `NEEDS_CHANGES`, the note is visible to the agency, and an email is sent.
7. Use **Reject** with a reason for profiles that should not proceed. Suspend/reinstate and verified badge changes are logged separately. The verified badge is not implied by approval.

## Bank reconciliation procedure

1. Open `/admin/payments` and select the pending manual transfer. Confirm the reference code, expected amount, expiry, and uploaded proof.
2. Enter the received amount, bank transaction reference, and received timestamp.
3. Use **Mark paid** only when the received amount exactly matches expected. The server checks duplicate bank references and applies the payment through the same activation service as the provider webhook, creating subscription/placement records and a receipt.
4. Use **Partial** only for a lower cumulative amount received. The payment remains `PARTIAL` and does not activate a subscription. When the remaining balance arrives, enter the new cumulative total (not only the newest deposit) and its bank reference, then mark paid once it exactly equals the expected amount. The audit log preserves each reconciliation step.
5. Reject or expire only after confirming the evidence. Every reconciliation action requires confirmation in the UI and records actor, before/after data and IP in the audit log.
6. Refunds require an explicit confirmation, reason, and amount not exceeding the unrefunded balance. PayMongo refunds call the provider; manual transfers are recorded as an adjustment. VAT-inclusive prices use a 12% VAT component in receipt display; validate registration/tax wording with your accountant before launch.

## Reports and operations

- `/admin/reports` provides a date range, revenue by month/provider/plan, subscription/agency/moderation counts, top agency event activity, overdue subscriptions, and CSV export.
- `/admin/leads` searches all enquiries and shows hashed-IP volume anomalies. Block email/phone/IP values only with a documented reason; raw values are hashed before storage.
- `/admin/audit` is the source for who changed an entity, when, from which IP, and its before/after values.
- Plan price edits affect new checkout quotes only. Existing subscription plan terms are not silently changed.
- Monthly summary and subscription lifecycle cron endpoints require `Authorization: Bearer $CRON_SECRET`. Schedule `/api/cron/subscriptions` daily and `/api/cron/admin-monthly-summary` monthly.
- Read-only impersonation is ADMIN-only, expires after 15 minutes, displays a banner, blocks mutating agency API requests, and is logged at start/stop.
