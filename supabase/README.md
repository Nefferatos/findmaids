# Supabase setup, reference data and sample agencies

Everything here is plain SQL for the Supabase **SQL Editor**: copy a file, paste
it, run it. No CLI or migration tooling is needed on your side.

## Quickest path: one file

**`ALL-IN-ONE-sample-setup.sql`** contains the maid table, the reference data and
the 5 sample agencies + 15 maids + 5 reviews in a single transaction. Paste the
whole file into the Supabase SQL Editor and press **Run** once. Re-running is
safe.

Use the individual files below only when you want to apply one step at a time.

## Run order (individual files)

| # | File | What it does | Safe to re-run |
|---|------|--------------|----------------|
| 1 | `staging-setup.sql` | Full schema, RLS, storage buckets. **Only on an empty project** — it aborts if the schema already exists. | No (guarded) |
| 2 | `002-maids-table.sql` | Adds the `MaidStatus` enum, the `Maid` table, its indexes, FK and RLS. Run this on any project that was created before maid profiles existed. | Yes |
| 3 | `003-reference-data.sql` | The data the app needs to run: 3 plans (Basic Free / Gold / Platinum), the platform FAQ entry and the 4 AI feature flags (disabled). | Yes |
| 4 | `004-sample-data.sql` | 5 demonstration agencies + 15 maid profiles + 5 reviews, so the site can be shown with realistic content. | Yes |
| 5 | `009-remove-sample-data.sql` | Deletes every sample agency and sample maid before launch. | Yes |

If your project already has the original schema, just run **2 → 3 → 4** in that
order.

## How the samples stay out of production

Sample rows are tagged in the database:

* agencies → `"adminNote" = 'findmaids:sample-data'`
* maids → `"isSample" = true`

`lib/sample-data.ts` → `sampleDataEnabled()` decides whether the app may show
them, and the filter is applied to every public query: directory search, homepage
nationality sections, hero/agency banners, popular services, the agency profile
page, `/api/public/agencies` and `sitemap.xml`.

| Runner | Samples shown? |
|---|---|
| `npm run dev` (localhost) | **yes** |
| `npm run build && npm start` (local production build) | no |
| Cloudflare / Vercel production (`APP_ENV`, `VERCEL_ENV`, `CF_PAGES` or `ENVIRONMENT` = `production`) | **no — always**, even with the flag below |
| Staging/preview deployment with `SHOW_SAMPLE_DATA=true` | yes (explicit demo opt-in) |

`wrangler.jsonc` already sets `APP_ENV=production`, so the deployed Worker can
never render samples. `NODE_ENV` is baked in as `production` by `next build`,
which is why a plain local `npm start` also hides them — use `npm run dev`, or
set `SHOW_SAMPLE_DATA=true` on a staging demo deployment.

```bash
# hide the samples locally as well
SHOW_SAMPLE_DATA=false npm run dev
```

## Schema the app reads

Table names in these files are unqualified, so they are created in the schema
your SQL Editor session uses — on Supabase that is **`public`**.

The app puts `?schema=…` on the connection string (`lib/prisma.ts`), defaulting
to a schema named `findmaids`. Make the two agree:

* Tables in `public` (the normal Supabase result of `staging-setup.sql`) →
  use a connection string that ends with `?schema=public`, or set
  `DATABASE_SCHEMA=public`.
* A dedicated schema → run `CREATE SCHEMA IF NOT EXISTS findmaids;` and
  `SET search_path TO findmaids;` at the top of the editor before pasting, and
  leave the app default (`findmaids`) alone.

Local Docker (`docker-compose.yml`) publishes Postgres on host port **5432**,
so `DATABASE_URL` must point at `127.0.0.1:5432` (or change the published port).

## Seeing the samples in the app

| Where | What you see | Needs the SQL? |
|---|---|---|
| `/sample/agency-dashboard` | Agency workspace preview + 9-maid roster. Uses built-in demo data in `lib/demo-listings.ts`. | No — works with no database at all |
| `/sample/maids`, `/sample/agencies` | Fictional profile/layout samples | No |
| `/`, `/agencies` | The 5 agency rows from `004` (grouped by nationality) | Yes |
| `/agencies/harbourlight-home-support` | That agency's 3 maid profiles (S-101…S-103) | Yes |
| `/agency/dashboard` (real agency area) | Overview, leads, billing, analytics for the sample agency | Yes, plus `npm run seed:sample-workspace` |

### Real agency dashboard demo (login)

`npm run seed:sample-workspace` creates the missing pieces that SQL deliberately
does not include (passwords never belong in SQL): a verified AGENCY owner, the
Basic Free subscription, 3 leads and 20 analytics events for the sample agency.
It refuses to run with `NODE_ENV=production`.

```
npm run seed:sample-workspace
# then sign in at /login
#   email    sample.owner@findmaids.test
#   password Sample-agency-12345   (override with SAMPLE_AGENCY_PASSWORD)
# dashboard  /agency/dashboard
```

Remove it again with `supabase/009-remove-sample-data.sql` plus
`DELETE FROM "User" WHERE "email" = 'sample.owner@findmaids.test';`.

## Verifying after pasting

```sql
-- 5 sample agencies, 15 sample maids
SELECT COUNT(*) FROM "Agency" WHERE "adminNote" = 'findmaids:sample-data';
SELECT COUNT(*) FROM "Maid"   WHERE "isSample" = true;

-- plans and flags
SELECT name, "priceMonthly", "listingPriority" FROM "Plan" ORDER BY "listingPriority";
SELECT key, enabled, scope FROM "FeatureFlag" ORDER BY key;
```

Then open `/agencies` and `/agencies/harbourlight-home-support` on your local
server to see the listings and their maid profiles.
