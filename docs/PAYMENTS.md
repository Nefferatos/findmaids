# Payments and subscriptions

## Environment

Set these in `.env` or your hosting secret store:

- `PAYMENT_PROVIDER=mock` for local development and tests; use `paymongo` to enable live provider requests.
- `PAYMONGO_SECRET_KEY` from the PayMongo dashboard. Use a test-mode secret during staging.
- `PAYMONGO_WEBHOOK_SECRET` for signature verification. Keep it server-only.
- `PAYMENT_WEBHOOK_SECRET` for the local MockProvider webhook signature.
- `MEDIA_STORAGE=local` enables the current local upload adapter. It is for a persistent Node development host only.
- `NEXTAUTH_URL` for checkout return URLs and `AUTH_SECRET` / `NEXTAUTH_SECRET` for authenticated sessions.
- `RESEND_API_KEY` and `EMAIL_FROM` for receipts and renewal reminders. Without a key, messages are logged to the server console for development.
- `CRON_SECRET` for `/api/cron/subscriptions`; scheduler calls must send `Authorization: Bearer <CRON_SECRET>`.

FindMaids does not collect or store card details. PayMongo checkout sessions handle provider payment methods. Never place real keys in git or client-side variables.

## Local checkout and webhook testing

1. Set `PAYMENT_PROVIDER=mock` and a local `PAYMENT_WEBHOOK_SECRET`.
2. Sign in with an approved agency, open `/agency/billing/checkout`, and select a paid plan. Mock checkout returns a success URL; it does not activate the plan without a webhook.
3. Copy the pending payment ID from the `mockPayment` parameter in that checkout URL. Send a signed test event (replace the ID and secret):

```powershell
$body = '{"eventId":"local-event-001","type":"payment.paid","paymentReference":"<PAYMENT_ID>","status":"paid"}'
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/webhooks/paymongo -Headers @{ "paymongo-signature" = "<PAYMENT_WEBHOOK_SECRET>" } -ContentType "application/json" -Body $body
```

The mock signature header is the shared secret itself and is accepted only outside production. This is a test adapter, not PayMongo signature behavior.
4. For PayMongo staging, set `PAYMENT_PROVIDER=paymongo`, configure test credentials, and expose the local server through a trusted HTTPS tunnel (for example, Cloudflare Tunnel or ngrok).
5. Register `https://<tunnel-host>/api/webhooks/paymongo` in the PayMongo webhook configuration and copy the signing secret into `PAYMONGO_WEBHOOK_SECRET`.
6. Send the provider's test payment events. The endpoint verifies the signature and timestamp, stores each event ID once, and returns `duplicate: true` for retries already processed.
7. Confirm the payment/subscription state and downloadable receipt in the agency dashboard. Never test with production keys or real card data.

## Lifecycle

```text
Approved agency -> Basic Free active
        |
        +-- choose Gold/Platinum -> pending subscription + pending payment
                                      |
                               hosted checkout
                                      |
               +----------------------+---------------------+
               |                                            |
          payment paid                                 failed/expired
               |                                            |
       webhook verified + deduplicated            active renewal -> PAST_DUE
               |                                            |
       payment PAID; invoice receipt                3-day grace period
       subscription ACTIVE; placements                     |
               |                              retry paid -> ACTIVE
       7-day and 1-day reminders                grace elapsed -> EXPIRED
               |                                            |
       upgrade -> immediate prorated             placements removed;
        free downgrade -> Basic at period end     paid downgrade -> checkout required
                                                          Basic fallback after grace
```

Upgrades are charged immediately for the remaining-period price difference. Annual plans are prorated using their monthly equivalent. Basic Free downgrades apply at period end. Paid-tier downgrades notify the agency to complete checkout; a paid plan is never granted without payment.

## Operational notes

- Run `GET /api/cron/subscriptions` daily from a trusted scheduler with the bearer secret. It is safe to retry; notice records suppress duplicate reminders.
- Automatic off-session recurring charges are not implemented; PayMongo checkout is single payment. The cron sends renewal reminders and starts the grace lifecycle, but an agency must complete checkout to renew.
- Configure a 3-day grace policy and retention schedule with counsel before production. Enquiry PII is anonymized after 12 months by this job; audit/payment records remain for reconciliation.
- Invoice PDFs are stored under `private/invoices` by the current local adapter. Use private object storage (for example R2) and signed access URLs before deploying to Cloudflare Workers; local filesystem invoice/media storage is not durable serverless storage.
- Manual bank deposit reconciliation is intentionally not exposed; `Payment.provider=MANUAL` is reserved for a later admin-controlled workflow.
