-- ============================================================================
-- FindMaids · 010 · Tag test/demo rows already in the database
-- Paste into the Supabase SQL Editor and run.
--
-- Why: seeds, staging fixtures and browser E2E runs have written agencies such
-- as "Casa Care (Demo)", "TEST Agency A (Basic)", "Demo Agency SG" and
-- "E2E Household Agency" straight into the shared database. They are real rows,
-- so the app only knows to hide them when they carry the sample marker.
--
-- This file stamps the marker on every row that obviously came from a fixture:
--   agencies  → "adminNote" = 'findmaids:sample-data'
--   their maids → "isSample" = true
--
-- Result:
--   * the Cloudflare / production deployment stops listing them immediately
--     (lib/sample-data.ts hides marked rows whenever it runs live);
--   * `npm run dev` on localhost keeps showing them, so local work is unchanged;
--   * nothing is deleted here — run supabase/009-remove-sample-data.sql to remove
--     the rows for good once they are no longer useful.
--
-- Safe to re-run. Only rows matching the same signatures the app uses are
-- touched (`lib/sample-data.ts` → testAgencyExclusions()).
-- ============================================================================

BEGIN;

-- 1. Tag agencies that are clearly fixture data.
UPDATE "Agency"
SET "adminNote" = 'findmaids:sample-data',
    "updatedAt" = NOW()
WHERE
      "adminNote" LIKE 'demo:%'
   OR "adminNote" LIKE 'test:%'
   OR "adminNote" = 'demo:homepage-banner'
   OR "name" ILIKE '%(demo)%'
   OR "name" ILIKE '%demo agency%'
   OR "name" ILIKE '%test agency%'
   OR "name" ILIKE '%sample agency%'
   OR "name" ILIKE '%e2e %'
   OR "name" ILIKE '%(test only)%'
   OR "email" ILIKE '%.test'
   OR "licenseNumber" ILIKE 'TEST%'
   OR "licenseNumber" ILIKE 'E2E%'
   OR "licenseNumber" ILIKE '%-TEST-%';

-- 2. Tag every maid profile that belongs to a tagged agency, plus any row the
--    seeds already flagged themselves.
UPDATE "Maid" m
SET "isSample" = true,
    "updatedAt" = NOW()
FROM "Agency" a
WHERE m."agencyId" = a."id"
  AND a."adminNote" = 'findmaids:sample-data'
  AND m."isSample" = false;

-- 3. Placeholder profiles written by the demo workspace/import fixtures under a
--    non-test agency (they render as "Maid SG-1042" because they have no name).
--    Remove a code from this list if it turns out to be real inventory.
UPDATE "Maid"
SET "isSample" = true,
    "updatedAt" = NOW()
WHERE "isSample" = false
  AND "reference" IN ('SG-1042', 'HCM-1042', 'SG-2087', 'HCM-2087');

COMMIT;

-- Verify: this is exactly the list the live site now hides but localhost shows.
SELECT "name", "slug", "email", "licenseNumber", "adminNote"
FROM "Agency"
WHERE "adminNote" = 'findmaids:sample-data'
ORDER BY "name";

SELECT a."name" AS agency, COUNT(*) AS sample_maids
FROM "Maid" m
JOIN "Agency" a ON a."id" = m."agencyId"
WHERE m."isSample" = true
GROUP BY a."name"
ORDER BY a."name";

-- Real agencies that must stay visible (sanity check — should be non-zero and
-- must not contain any test/demo row):
SELECT COUNT(*) AS visible_agencies
FROM "Agency"
WHERE "status" = 'APPROVED'
  AND COALESCE("adminNote", '') NOT LIKE 'findmaids:sample-data%'
  AND COALESCE("adminNote", '') NOT LIKE 'demo:%'
  AND COALESCE("adminNote", '') NOT LIKE 'test:%';
