-- ============================================================================
-- FindMaids · 009 · Remove ALL sample agencies and sample maids
-- Run this before launch (or any time you no longer want the demo records).
--
-- Removes:
--   * every maid row with isSample = true
--   * every agency tagged adminNote = 'findmaids:sample-data'
--     (reviews, enquiries, photos, subscriptions, ad placements and maids of
--      those agencies are removed by ON DELETE CASCADE)
--
-- Real agencies and real maids are not touched.
-- ============================================================================

BEGIN;

DELETE FROM "Maid" WHERE "isSample" = true;

DELETE FROM "Agency" WHERE "adminNote" = 'findmaids:sample-data';

COMMIT;

-- Verify (both counts should be 0):
-- SELECT COUNT(*) AS sample_maids FROM "Maid" WHERE "isSample" = true;
-- SELECT COUNT(*) AS sample_agencies FROM "Agency" WHERE "adminNote" = 'findmaids:sample-data';
