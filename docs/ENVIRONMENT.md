# Environments and Configuration

Use isolated credentials and data for each environment. Never copy production secrets into local development, pull requests, or test fixtures.

| Environment | Database/storage                                                          | Keys and providers                                                                                        | Data / actions                                                                                   |
| ----------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Local       | Local pgvector Postgres and local Redis, or isolated Supabase dev project | Mock AI and payment providers; disposable Resend/test credentials; Turnstile optional only for local mock | Synthetic seed data only. `EMAIL_DELIVERY_DISABLED=true` for E2E.                                |
| Staging     | Separate Supabase project/buckets and Redis namespace                     | Separate Auth, Resend verified test sender, Make/Claude test keys, PayMongo test mode, webhook secrets    | Synthetic or minimized test data. Run migrations and full E2E here.                              |
| Production  | Owner-selected host, dedicated Supabase project/region and managed Redis  | Production-only secret manager; PayMongo live keys only after approval; AI off until staged rollout       | No seed sample accounts or fake enquiries. Create initial ADMIN via controlled secure procedure. |

## Variables

Copy `.env.example` to an ignored local `.env`; replace every placeholder. Key groups:

- Runtime/Auth: `NEXT_PUBLIC_SITE_URL`, `NEXTAUTH_URL`, `AUTH_SECRET`, `NEXTAUTH_SECRET`, Google OAuth credentials, `TOTP_ENCRYPTION_KEY`.
- Database/storage: `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, server-only `SUPABASE_SERVICE_ROLE_KEY`, bucket names.
- Email/bot protection: `RESEND_API_KEY`, `EMAIL_FROM`, `DATA_REQUEST_EMAIL`, Turnstile site/secret keys.
- Payments/cron: PayMongo test/live keys and webhook secret, `PAYMENT_PROVIDER`, `CRON_SECRET`.
- AI: default `AI_PROVIDER=mock`; `AI_PROVIDER=make` requires protected Make webhook and embeddings URL/secrets; `AI_PROVIDER=claude` requires `AI_API_KEY`. Keep feature flags off until approved.
- Jobs/retention: `REDIS_URL`, `DATA_RETENTION_DAYS` (default 365; legal approval required).
- Monitoring: optional `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`, trace sample rates, and `LOG_LEVEL`. Sentry is disabled without a DSN and configured with PII collection disabled and request data scrubbing.

Never expose server-only values with `NEXT_PUBLIC_`. `.env.example` contains placeholders only. CI secrets belong in GitHub Actions secrets/environments. Rotate any credential suspected of exposure.

## Local setup

1. Set `POSTGRES_PASSWORD` in ignored `.env`; start `docker compose up -d db redis`.
2. Configure local `DATABASE_URL` and `DIRECT_URL` to the local service, plus random local auth/TOTP secrets.
3. Run `npx prisma migrate deploy`, `npx prisma generate`, and `ALLOW_SAMPLE_SEED=true npm run seed` against local DB only.
4. Use `AI_PROVIDER=mock`, `PAYMENT_PROVIDER=mock`, `EMAIL_DELIVERY_DISABLED=true`; use synthetic test accounts.
5. Run `npm run dev` and `npm run jobs:worker` in separate terminals when validating background jobs.

## Hosted deployment decision

Hosting provider is not selected. The owner must choose Vercel + Supabase/Neon + managed Redis or a VPS/Docker host before deployment configuration is generated. Do not run production migrations or change live payment/legal settings without explicit approval.
