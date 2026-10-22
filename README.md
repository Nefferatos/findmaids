# FindMaids

FindMaids is a directory and advertising platform for independent domestic staffing agencies in the Philippines. This release includes account authentication, public directory pages, agency enquiries and reviews, advertiser information, and the initial AI-ready foundation. It does not include payments, an agency management dashboard, or live AI calls.

## Requirements

- Node.js 20.19+ (or a supported current LTS)
- npm
- Docker Desktop with Docker Compose

## Local setup

Run from the `findmaids` directory:

```powershell
Copy-Item .env.example .env
# Set a strong random value for AUTH_SECRET and NEXTAUTH_SECRET in .env.
docker compose up -d
npm install
npx prisma migrate dev
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

The Playwright enquiry test requires an approved agency row and `E2E_AGENCY_SLUG` set to its slug. The account lifecycle test uses the database and requires migrations. To stop PostgreSQL, run `docker compose down`; data persists in the named volume. `docker compose down -v` also removes that local database data.

## Configuration

`.env` and secret-bearing env files are git-ignored; `.env.example` contains placeholders only. Set matching strong random values for `AUTH_SECRET` and `NEXTAUTH_SECRET`. Google sign-in requires `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, and `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`. Resend delivery requires `RESEND_API_KEY` and a verified `EMAIL_FROM`; without a key, emails are logged to the server console for development only. Optional Cloudflare Turnstile requires both `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`.

The consent, Terms, and Privacy copy is draft text and requires review by qualified Philippine counsel/privacy professionals before launch. Enquiry details are sent only to the selected agency and the employer confirmation goes to the submitting email. Agency listings and reviews do not constitute a guarantee or endorsement.

Gold and Platinum plan amounts are development placeholders (PHP 999/₱9,990 and PHP 1,999/₱19,990); Basic Free is PHP 0. Review them before launch. `AI_PROVIDER=make` remains an adapter placeholder and makes no requests.

## Project structure

- `app/(public)`: employer-facing pages
- `app/(agency)` and `app/(admin)`: role-protected placeholder areas
- `app/api`: authentication, enquiry, review, analytics, and health endpoints
- `components`: shared responsive UI and forms
- `lib/ai`: provider contracts, guardrails, logging, flags, prompts, and tool stubs
- `lib/directory.ts` and `lib/ranking.ts`: directory filters and recommendation ranking
- `prisma`: PostgreSQL/pgvector schema, migrations, and development seed
- `content/guides`: MDX articles
- `tests`: Vitest unit tests; `e2e`: Playwright browser smoke tests

`KnowledgeDocument.embedding` uses PostgreSQL `vector(1536)`. After schema changes, run `npx prisma generate` and create/apply a migration.
