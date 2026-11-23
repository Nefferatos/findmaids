-- ============================================================================
-- FindMaids · 009 · Remove ALL sample / test agencies and sample maids
-- Run this before launch (or any time you no longer want the demo records).
--
-- Removes:
--   * every maid row with isSample = true
--   * every maid row of a test/demo agency
--   * every agency that is marked or recognisable as fixture data:
--       - "adminNote" = 'findmaids:sample-data'   (sample SQL + seeds)
--       - "adminNote" LIKE 'demo:%' / 'test:%'    (older seed notes)
--       - names such as "… (Demo)", "TEST Agency …", "Demo Agency …"
--       - fixture contact details: '.test' e-mail, TEST-/E2E- licence numbers
--     (reviews, enquiries, photos, subscriptions, ad placements and maids of
--      those agencies are removed by ON DELETE CASCADE)
--
-- Real agencies and real maids are not touched. The signature list matches
-- lib/sample-data.ts (testAgencyExclusions()), so anything the live site hides
-- is deleted here.
--
-- Tip: run 010-tag-test-data.sql first if you only want the live site to stop
-- showing the rows while keeping them for localhost development.
-- ============================================================================

BEGIN;

DELETE FROM "Maid"
WHERE "isSample" = true
   OR "agencyId" IN (
        SELECT "id" FROM "Agency"
        WHERE "adminNote" LIKE 'findmaids:sample-data%'
           OR "adminNote" LIKE 'demo:%'
           OR "adminNote" LIKE 'test:%'
           OR "name" ILIKE '%(demo)%'
           OR "name" ILIKE '%demo agency%'
           OR "name" ILIKE '%test agency%'
           OR "name" ILIKE '%sample agency%'
           OR "name" ILIKE '%e2e %'
           OR "name" ILIKE '%(test only)%'
           OR "email" ILIKE '%.test'
           OR "licenseNumber" ILIKE 'TEST%'
           OR "licenseNumber" ILIKE 'E2E%'
           OR "licenseNumber" ILIKE '%-TEST-%'
      );

DELETE FROM "Agency"
WHERE "adminNote" LIKE 'findmaids:sample-data%'
   OR "adminNote" LIKE 'demo:%'
   OR "adminNote" LIKE 'test:%'
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

COMMIT;

-- Verify (all three counts should be 0):
-- SELECT COUNT(*) AS sample_maids FROM "Maid" WHERE "isSample" = true;
-- SELECT COUNT(*) AS sample_agencies FROM "Agency" WHERE "adminNote" LIKE 'findmaids:sample-data%';
-- SELECT COUNT(*) AS test_named FROM "Agency" WHERE "name" ILIKE '%(demo)%' OR "name" ILIKE '%test agency%';
