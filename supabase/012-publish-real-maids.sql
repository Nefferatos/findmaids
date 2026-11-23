-- ============================================================================
-- FindMaids · 012 · Publish the real imported maid inventory
-- Paste into the Supabase SQL Editor and run after 010 (and 011).
--
-- Why: `scripts/maid-migrate.ts` imports profiles unpublished unless it is run
-- with --publish, so the real inventory (At The Agency) sat in the database
-- while only the hand-published test profiles were visible on the site.
--
-- What this publishes: every unpublished maid whose agency is a real, approved
-- agency - i.e. the row is not marked as sample/test and the agency does not
-- carry a fixture marker, a demo/test/sample name, a `.test` e-mail or a TEST/E2E
-- licence number. Demo and test rows are skipped; run 010 first to tag them.
--
-- Nothing is deleted. Re-running only touches rows that are still unpublished,
-- so a profile hidden on purpose by its agency stays hidden as long as its
-- `published` flag is false (this statement is not part of the app runtime).
-- ============================================================================

BEGIN;

UPDATE "Maid" m
SET "published" = true,
    "updatedAt" = NOW()
FROM "Agency" a
WHERE a."id" = m."agencyId"
  AND a."status" = 'APPROVED'
  AND NOT m."isSample"
  AND NOT m."published"
  AND NULLIF(btrim(m."fullName"), '') IS NOT NULL
  AND COALESCE(a."adminNote", '') NOT LIKE 'findmaids:sample-data%'
  AND COALESCE(a."adminNote", '') NOT LIKE 'demo:%'
  AND COALESCE(a."adminNote", '') NOT LIKE 'test:%'
  AND a."name" NOT ILIKE '%(demo)%'
  AND a."name" NOT ILIKE '%(test only)%'
  AND a."name" NOT ILIKE '%demo agency%'
  AND a."name" NOT ILIKE '%test agency%'
  AND a."name" NOT ILIKE '%sample agency%'
  AND a."name" NOT ILIKE '%e2e %'
  AND a."email" NOT ILIKE '%.test'
  AND (
    a."licenseNumber" IS NULL
    OR (
      a."licenseNumber" NOT LIKE 'TEST%'
      AND a."licenseNumber" NOT LIKE 'E2E%'
      AND a."licenseNumber" NOT LIKE '%-TEST-%'
    )
  );

COMMIT;

-- Verify: published per agency (only the real agency should have a large count).
-- SELECT a."name", COUNT(*) FILTER (WHERE m."published") AS published, COUNT(*) AS total
-- FROM "Maid" m JOIN "Agency" a ON a."id" = m."agencyId"
-- GROUP BY a."name" ORDER BY 2 DESC;
