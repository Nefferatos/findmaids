# Staging

Isolated dry-run environment on its own Supabase project (ref `tajpujqabclbxoggkxse`). Nothing here may touch production, send real email or WhatsApp, or take real payments.

## Safety rules

- All configuration lives in the single Git-ignored `.env` — use **profile B** in that file. There is no `.env.staging`/`.env.test`. Never commit `.env`; never paste its values into chat or logs.
- Write scripts are guarded by `lib/security/staging-guard.ts` (`assertStagingWriteAllowed()`), which refuses unless `APP_ENV` is `staging` or `test`, `STAGING_PROJECT_REF` is set, and that ref appears in both `DATABASE_URL` and `DIRECT_URL`. All four settings sit together in `.env` profile B. There is no wrapper script — the staging seed and `playwright.config.ts` call the same guard directly.
- Email is not delivered (`EMAIL_DELIVERY_DISABLED=true`; no `RESEND_API_KEY`). Payments use the mock provider. WhatsApp is off. AI is `mock`.

## Environment variables

| Variable | Staging value / purpose |
| --- | --- |
| `APP_ENV` | `staging` (guard requires `staging` or `test`) |
| `NODE_ENV` | `development` |
| `STAGING_PROJECT_REF` | Supabase project ref; must appear in both database URLs |
| `DATABASE_URL` | Supabase Transaction pooler (port 6543) with `pgbouncer=true&connection_limit=1`; app runtime |
| `DIRECT_URL` | Supabase Session pooler (port 5432); migrations, seed, verification |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key; never exposed to the browser or a `NEXT_PUBLIC_` variable |
| `SUPABASE_MEDIA_BUCKET` / `SUPABASE_PRIVATE_BUCKET` | `findmaids-media` (public) / `findmaids-private` |
| `NEXTAUTH_URL`, `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` |
| `NEXTAUTH_SECRET`, `AUTH_SECRET`, `TOTP_ENCRYPTION_KEY`, `CRON_SECRET`, `PAYMENT_WEBHOOK_SECRET` | Random local values generated for staging |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` | Empty / `false` |
| `EMAIL_FROM`, `DATA_REQUEST_EMAIL` | `staging@example.test` |
| `EMAIL_DELIVERY_DISABLED` | `true`; emails are logged to the console only |
| `RESEND_API_KEY`, `EMAIL_WEBHOOK_SECRET` | Empty |
| `PAYMENT_PROVIDER` | `mock` |
| `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET` | Empty |
| `WHATSAPP_WEBHOOK_SECRET` | Empty (WhatsApp off) |
| `AI_PROVIDER`, `AI_MODEL` | `mock` / `mock` |
| `AI_API_KEY`, `AI_*_WEBHOOK_*`, `AI_WEBHOOK_URL` | Empty |
| `AI_MONTHLY_BUDGET_PHP`, `AI_DEFAULT_AGENCY_BUDGET_PHP` | `0` |
| `AI_MAX_TOKENS`, `AI_RATE_LIMIT`, `AI_TEMPERATURE`, `AI_TIMEOUT_MS`, `AI_EMBEDDING_DIMENSIONS`, `AI_PHP_PER_USD`, `AI_INPUT_USD_PER_MILLION`, `AI_OUTPUT_USD_PER_MILLION` | Defaults from `.env.example` |
| `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare's public always-pass test keys |
| `REDIS_URL` | Empty (jobs run inline) |
| `LEAD_CAP_MODE` | `DELIVER_ALL` (provisional, see [DECISIONS.md](DECISIONS.md)) |
| `FOUNDING_PERIOD_EMAILS_ENABLED` | `false` |
| `SUPPORTED_LANGUAGES` | `en` |
| `DATA_RETENTION_DAYS` | `365` |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Empty; trace sample rates `0` |
| `LOG_LEVEL` | `info` |
| `E2E_TEST_PASSWORD` | Shared password of the fake test accounts (random, local) |
| `E2E_ADMIN_TOTP_SECRET` | TOTP secret of `admin@example.test` (admin login requires 2FA) |

## Test accounts (seeded)

| Email | Role | Notes |
| --- | --- | --- |
| `admin@example.test` | ADMIN | 2FA enabled with `E2E_ADMIN_TOTP_SECRET` |
| `staff@example.test` | STAFF | No access to payments, plans or roles |
| `agency-a@example.test` | AGENCY | TEST Agency A, Basic Free, monthly allowance 2 |
| `agency-b@example.test` | AGENCY | TEST Agency B, founding Gold grant ending in 3 days (at seed time) |
| `agency-c@example.test` | AGENCY | TEST Agency C, Gold paid with the mock provider |

Each agency has two fake prospects (`CONTACTED` and `DO_NOT_CONTACT`). Licence numbers start with `TEST-`. The staging seed sets the `Basic Free` plan's `leadLimit` to 2 in this database only.

## Commands

All from the repository root in PowerShell. `.env` must be on **profile B** first (see the comments in that file):

```powershell
# Guarded scripts read the guard values from .env, so no wrapper is needed:
$env:APP_ENV = 'staging'; $env:STAGING_PROJECT_REF = 'tajpujqabclbxoggkxse'   # only if not already in .env
$env:E2E_TEST_PASSWORD = '<local password>'; $env:E2E_ADMIN_TOTP_SECRET = '<base32 secret>'  # seed only

npm run db:deploy                                          # prisma migrate deploy (baseline first if tables exist)
npx --no-install tsx prisma/seed-staging.ts                 # guarded staging seed (idempotent)
npx --no-install tsx scripts/verify-staging-db.ts           # tables, vector index, RLS
npx --no-install tsx scripts/verify-staging-storage.ts      # buckets, limits, signed URLs
npm run dev                                                 # app against staging on :3000
npx --no-install playwright test                            # E2E (loads .env, starts its own server)
```

Stop any other dev server on port 3000 first so the app is not connected to another database. Results are saved in `staging-results/`.
