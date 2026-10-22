# FindMaids

Foundation for a Philippines-based B2B maid-agency directory. This step provides the application and data foundation only; public, agency, and admin pages, payments, authentication, and live AI calls are not implemented.

## Requirements

- Node.js 20.19+ (or a supported current LTS)
- npm
- Docker Desktop with Docker Compose, for local PostgreSQL/pgvector

## Local setup

```bash
cp .env.example .env
# PowerShell: Copy-Item .env.example .env
docker compose up -d
npm install
npx prisma migrate dev --name init
npm run seed
npm run dev
```

Open <http://localhost:3000/api/health> to inspect database and AI-provider status. The default provider is `mock`; no external AI requests are made. Vitest checks run with:

```bash
npm test
npm run lint
```

To stop PostgreSQL, run `docker compose down`. Its data persists in the `findmaids-postgres-data` volume. To remove that local data as well, run `docker compose down -v`.

## Configuration

Edit `.env` for local settings. `.env` and other secret-bearing env files are ignored by git; `.env.example` is safe to commit. Keep `AI_PROVIDER=mock` until an explicitly implemented provider integration is ready. `AI_PROVIDER=make` is currently a placeholder that expects future integration work and will not make live calls. Do not use real credentials in this repository.

The Gold and Platinum plan amounts in the seed are development placeholders in PHP and should be reviewed before any production use. Basic Free is seeded at PHP 0.

## Project structure

- `app/(public)`, `app/(agency)`, `app/(admin)`: route group foundations
- `app/api/health`: database and active provider health check
- `app/apicomponents`: reserved API component/module directory
- `lib/ai`: provider contracts, guardrails, logging, feature flags, prompts, and tool stubs
- `prisma`: schema, migrations, and sample seed data
- `emails`: reserved email templates
- `tests`: Vitest checks

Prisma's PostgreSQL extension configuration enables `pgvector`; the `KnowledgeDocument.embedding` column is `vector(1536)`. Run `npx prisma generate` after schema changes.
