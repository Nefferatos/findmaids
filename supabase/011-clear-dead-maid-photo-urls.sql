-- ============================================================================
-- FindMaids · 011 · Clear maid photo paths this deployment cannot serve
-- Paste into the Supabase SQL Editor and run after 010.
--
-- Why: profiles imported from the old ATS app kept the source's relative paths
-- (`/uploads/maids/agency-1/<ref>/photos/<file>.jpg`). Those files were never
-- copied into this project - the old storage bucket no longer has them - so the
-- paths can only ever render a broken image. The app already ignores them and
-- shows the maid's initials instead (lib/maid-photo.ts); this file makes the
-- database match reality so the agency edit form no longer pre-fills a dead URL.
--
-- Photos must be re-uploaded by the agency: /agency/maids → profile → Photos
-- (uploads are stored in Supabase Storage and return working `https://` URLs).
--
-- Real photos stored as `https://…supabase.co/storage/v1/object/public/…` are
-- untouched. Safe to re-run.
-- ============================================================================

BEGIN;

UPDATE "Maid"
SET "photoUrl" = NULL,
    "updatedAt" = NOW()
WHERE "photoUrl" LIKE '/uploads/%';

UPDATE "Maid"
SET "photoUrls" = ARRAY(
      SELECT url FROM unnest("photoUrls") AS url WHERE url NOT LIKE '/uploads/%'
    ),
    "photoThumbnailUrls" = ARRAY(
      SELECT url FROM unnest("photoThumbnailUrls") AS url WHERE url NOT LIKE '/uploads/%'
    ),
    "photoPortraitUrls" = ARRAY(
      SELECT url FROM unnest("photoPortraitUrls") AS url WHERE url NOT LIKE '/uploads/%'
    ),
    "updatedAt" = NOW()
WHERE EXISTS (
  SELECT 1
  FROM unnest("photoUrls" || "photoThumbnailUrls" || "photoPortraitUrls") AS url
  WHERE url LIKE '/uploads/%'
);

COMMIT;

-- Verify (all counts should be 0):
-- SELECT COUNT(*) AS dead_primary FROM "Maid" WHERE "photoUrl" LIKE '/uploads/%';
-- SELECT COUNT(*) AS dead_in_lists FROM "Maid"
--  WHERE EXISTS (SELECT 1 FROM unnest("photoUrls" || "photoThumbnailUrls" || "photoPortraitUrls") u WHERE u LIKE '/uploads/%');

-- How many published profiles now have a working photo (expect > 0):
-- SELECT COUNT(*) AS with_photo FROM "Maid"
--  WHERE published AND NOT "isSample" AND "photoUrl" LIKE 'https://%';
