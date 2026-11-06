# FindMaids

FindMaids is a Singapore-focused directory and advertising platform for independent domestic staffing agencies based in Singapore. Agencies can describe overseas service locations, which are displayed on their profiles and can be searched by exact service-location text. The app includes public pages, agency onboarding and dashboard, admin moderation and test-only payment flows, reports, and opt-in deterministic AI demo workflows. Automated card-on-file renewal and external AI provider calls are not enabled.

## Requirements

- Node.js 20.19+ (or a supported current LTS)
- npm
- A Supabase project for Postgres and Storage
- Docker Desktop only if you choose to run local PostgreSQL instead

## Local setup

Run from the `findmaids` directory. For Supabase, copy the project pooler URL into `DATABASE_URL`, direct URL into `DIRECT_URL`, and configure the two Storage buckets and server-only key as described in [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md):

```powershell
Copy-Item .env.example .env
# Set the Supabase and strong auth secrets in .env.
npm install
npx prisma migrate deploy
npm run seed
npm run dev
```

Open <http://localhost:3000>. `/api/health` reports database and AI-provider status. The default AI provider is `mock` and makes no external AI calls. Run checks with:

```powershell
npm run lint
npm test
npx tsc --noEmit
npm run build
npm run test:e2e
```

The `.env.example` defaults to `PAYMENT_PROVIDER=mock`, uses provisional SGD amounts, and keeps manual bank transfer disabled. No real payment provider is approved or configured for the Singapore site. Do not collect real payments until a suitable provider, legal/tax wording, and reconciliation process have been reviewed. Read [docs/PAYMENTS.md](docs/PAYMENTS.md) for payment setup and safeguards.

The Playwright enquiry test requires an approved agency row and `E2E_AGENCY_SLUG` set to its slug. The account lifecycle test uses the database and requires migrations.

## Configuration

`.env` and secret-bearing env files are git-ignored; `.env.example` contains placeholders only. Set matching strong random values for `AUTH_SECRET` and `NEXTAUTH_SECRET`. Google sign-in requires `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, and `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`. Resend delivery requires `RESEND_API_KEY` and a verified `EMAIL_FROM`; without a key, emails are logged to the server console for development only. Optional Cloudflare Turnstile requires both `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`.

Payment configuration uses `PAYMENT_PROVIDER=mock` for non-production tests and `PAYMENT_WEBHOOK_SECRET`; the PayMongo adapter is not available for the Singapore business configuration. Configure `CRON_SECRET` for the subscription lifecycle job and `DATA_REQUEST_EMAIL` for privacy request notifications. Supabase Postgres uses `DATABASE_URL` (pooled URL for runtime) and `DIRECT_URL` (direct connection for Prisma migrations). Supabase Storage uses `SUPABASE_URL`, server-only `SUPABASE_SERVICE_ROLE_KEY`, and public/private buckets named by `SUPABASE_MEDIA_BUCKET` and `SUPABASE_PRIVATE_BUCKET`. Create the media bucket as public and the private bucket as private; private objects are served only through authenticated app routes. Storage requires Supabase configuration in development and production.

The consent, Terms, Privacy, and Cookie copy is draft text and requires review by qualified Singapore counsel/privacy professionals before launch. Enquiry details are sent only to the selected agency and the employer confirmation goes to the submitting email. Agency listings and reviews do not constitute a guarantee or endorsement. Review retention and cross-border data handling with qualified advisers.

Gold and Platinum plan amounts are provisional SGD test values (999/9,990 and 1,999/19,990); Basic Free is SGD 0. They are not approved launch prices. Upgrades use remaining-period proration; downgrades apply at renewal. Real payment collection is not enabled. The employer assistant and agency draft helpers are disabled by default, make no external AI calls in mock mode, and are managed via Admin > Settings > `featureFlags`.

## Project structure

- `app/(public)`: employer-facing pages
- `app/(agency)`: onboarding, billing and role-protected dashboard
- `app/(admin)`: role-protected moderation, billing, reporting, and operations
- `app/api`: authentication, onboarding, payment, webhook, dashboard, enquiry, review and health endpoints
- `components`: shared responsive UI and forms
- `lib/ai`: provider contracts, guardrails, logging, feature flags, prompts, grounded demo tools
- `lib/directory.ts` and `lib/ranking.ts`: directory filters and recommendation ranking
- `prisma`: PostgreSQL/pgvector schema, migrations, and development seed
- `content/guides`: MDX articles
- `docs/PAYMENTS.md`: provider and lifecycle setup
- `docs/SUPABASE_SETUP.md`: Supabase Postgres and Storage setup
- `tests`: Vitest unit tests; `e2e`: Playwright browser smoke tests

`KnowledgeDocument.embedding` uses PostgreSQL `vector(1536)`. After schema changes, run `npx prisma generate` and create/apply a migration.
