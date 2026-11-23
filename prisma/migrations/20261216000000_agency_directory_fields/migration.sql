-- Agency directory fields used by /maid-agency.
--
-- Everything is nullable: existing agencies keep working and only gain the new
-- columns when they upload narrow banner artwork or fill in a postal code /
-- contact person (coordinates are intended to be back-filled by geocoding).

ALTER TABLE "Agency"
  ADD COLUMN IF NOT EXISTS "postalCode" TEXT,
  ADD COLUMN IF NOT EXISTS "contactPerson" TEXT,
  ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "bannerLeftUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "bannerRightUrl" TEXT;
