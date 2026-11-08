-- ============================================================================
-- FindMaids - ALL-IN-ONE Supabase setup (paste this whole file, run once)
--
-- Contains, in order:
--   1. MaidStatus enum + "Maid" table, indexes, foreign key and RLS
--   2. Reference data the app needs: 3 plans, platform FAQ, 4 AI flags
--   3. 5 SAMPLE agencies + 15 sample maids + 5 sample reviews
--
-- Requirements: the base FindMaids schema must already exist in this project
-- (supabase/staging-setup.sql). Table names are unqualified, so everything lands
-- in the schema your SQL Editor session uses - on Supabase that is public.
--
-- Safe to re-run: the DDL is guarded, plans are upserted, sample rows use
-- ON CONFLICT DO NOTHING, and the whole file is one transaction.
-- Sample rows never reach the live site: the app hides rows tagged
-- adminNote = 'findmaids:sample-data' / isSample = true outside development.
-- To delete them later, run supabase/009-remove-sample-data.sql.
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1 of 3 - Maid table (enum, table, indexes, FK, RLS)
-- ============================================================================
-- ============================================================================
-- FindMaids · 002 · Maid profiles table
-- Paste into the Supabase SQL Editor and run.
--
-- Safe to run more than once: every statement checks for existing objects.
-- Run this BEFORE 004-sample-data.sql (it inserts maid rows).
--
-- Table names are unqualified, so the objects are created in the schema that
-- your SQL Editor session points at (normally `public`). The app must read the
-- same schema — see supabase/README.md.
-- ============================================================================

-- 1. Status enum -------------------------------------------------------------
DO $$
BEGIN
  CREATE TYPE "MaidStatus" AS ENUM ('AVAILABLE', 'ON_HOLD', 'PLACED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Table -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Maid" (
  "id"              TEXT NOT NULL,
  "agencyId"        TEXT NOT NULL,
  "reference"       TEXT NOT NULL,
  "nationality"     TEXT NOT NULL,
  "age"             INTEGER,
  "languages"       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "placementType"   TEXT NOT NULL,
  "experienceYears" INTEGER,
  "duties"          TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "monthlySalary"   INTEGER,
  "status"          "MaidStatus" NOT NULL DEFAULT 'AVAILABLE',
  "availableFrom"   TEXT,
  "photoUrl"        TEXT,
  "notes"           TEXT,
  "published"       BOOLEAN NOT NULL DEFAULT true,
  "isSample"        BOOLEAN NOT NULL DEFAULT false,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Maid_pkey" PRIMARY KEY ("id")
);

-- 3. Indexes -----------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "Maid_agencyId_reference_key"
  ON "Maid" ("agencyId", "reference");

CREATE INDEX IF NOT EXISTS "Maid_agencyId_published_idx"
  ON "Maid" ("agencyId", "published");

CREATE INDEX IF NOT EXISTS "Maid_nationality_status_idx"
  ON "Maid" ("nationality", "status");

-- 4. Foreign key -------------------------------------------------------------
DO $$
BEGIN
  ALTER TABLE "Maid"
    ADD CONSTRAINT "Maid_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "Agency" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 5. Row Level Security ------------------------------------------------------
-- The public Supabase API (anon/authenticated) must not read app data. The app
-- connects with the server-side database role, which bypasses RLS.
ALTER TABLE "Maid" ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 2 of 3 - Reference data (plans, platform FAQ, AI feature flags)
-- ============================================================================
-- ============================================================================
-- FindMaids · 003 · Reference data (required by the running app)
-- Paste into the Supabase SQL Editor and run after 002.
--
-- Idempotent: plans are upserted by name, the FAQ setting by key, and feature
-- flags are only inserted when missing. No users, agencies or customer data are
-- created here.
-- ============================================================================


-- 1. Subscription plans ------------------------------------------------------
INSERT INTO "Plan" ("id", "name", "priceMonthly", "priceYearly", "features",
                    "listingPriority", "featuredSlots", "maxPhotos", "leadLimit",
                    "aiMonthlyBudgetSgd", "isActive", "createdAt", "updatedAt")
VALUES
  ('plan-basic-free', 'Basic Free', 0.00, 0.00,
   '["Agency profile", "Up to 3 photos", "10 enquiries per month"]'::jsonb,
   0, 0, 3, 10, 0.00, true, NOW(), NOW()),
  ('plan-gold', 'Gold', 999.00, 9990.00,
   '["Enhanced profile", "Up to 10 photos", "Priority listing"]'::jsonb,
   10, 1, 10, 100, 50.00, true, NOW(), NOW()),
  ('plan-platinum', 'Platinum', 1999.00, 19990.00,
   '["Premium profile", "Up to 25 photos", "Homepage banner", "Featured card", "Category top placement"]'::jsonb,
   20, 1, 25, NULL, 150.00, true, NOW(), NOW())
ON CONFLICT ("name") DO UPDATE SET
  "priceMonthly"       = EXCLUDED."priceMonthly",
  "priceYearly"        = EXCLUDED."priceYearly",
  "features"           = EXCLUDED."features",
  "listingPriority"    = EXCLUDED."listingPriority",
  "featuredSlots"      = EXCLUDED."featuredSlots",
  "maxPhotos"          = EXCLUDED."maxPhotos",
  "leadLimit"          = EXCLUDED."leadLimit",
  "aiMonthlyBudgetSgd" = EXCLUDED."aiMonthlyBudgetSgd",
  "isActive"           = EXCLUDED."isActive",
  "updatedAt"          = NOW();

-- 2. Platform FAQ (admin setting read by the FAQ page / AI tools) ------------
INSERT INTO "AdminSetting" ("key", "value", "createdAt", "updatedAt")
VALUES (
  'platformFaq',
  '{"entries":[
    {"question":"Does FindMaids recruit or employ domestic workers?","answer":"No. FindMaids is a directory and advertising platform. Agencies are independent third parties."},
    {"question":"Are agency listings guaranteed or endorsed?","answer":"No. A profile, verification indicator, or sponsored placement is not a guarantee or endorsement. Verify agency credentials and terms directly."},
    {"question":"How do I contact an agency?","answer":"Open an approved agency profile and use its contact information or submit the enquiry form."},
    {"question":"How are reviews displayed?","answer":"Reviews remain pending until moderated. Only published reviews appear on profiles."}
  ]}'::jsonb,
  NOW(), NOW()
)
ON CONFLICT ("key") DO UPDATE SET
  "value"     = EXCLUDED."value",
  "updatedAt" = NOW();

-- 3. AI feature flags (disabled until reviewed) ------------------------------
-- agencyId is NULL, and Postgres treats NULLs as distinct in unique indexes, so
-- a plain ON CONFLICT cannot be used here. Insert only when missing instead.
INSERT INTO "FeatureFlag" ("id", "key", "enabled", "scope", "agencyId", "createdAt", "updatedAt")
SELECT 'ff-employer-assistant', 'employer_assistant', false, 'GLOBAL', NULL, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "FeatureFlag" WHERE "key" = 'employer_assistant' AND "scope" = 'GLOBAL' AND "agencyId" IS NULL);

INSERT INTO "FeatureFlag" ("id", "key", "enabled", "scope", "agencyId", "createdAt", "updatedAt")
SELECT 'ff-agency-auto-reply', 'agency_auto_reply', false, 'GLOBAL', NULL, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "FeatureFlag" WHERE "key" = 'agency_auto_reply' AND "scope" = 'GLOBAL' AND "agencyId" IS NULL);

INSERT INTO "FeatureFlag" ("id", "key", "enabled", "scope", "agencyId", "createdAt", "updatedAt")
SELECT 'ff-agency-profile-helper', 'agency_profile_helper', false, 'GLOBAL', NULL, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "FeatureFlag" WHERE "key" = 'agency_profile_helper' AND "scope" = 'GLOBAL' AND "agencyId" IS NULL);

INSERT INTO "FeatureFlag" ("id", "key", "enabled", "scope", "agencyId", "createdAt", "updatedAt")
SELECT 'ff-agency-knowledge-base', 'agency_knowledge_base', false, 'GLOBAL', NULL, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "FeatureFlag" WHERE "key" = 'agency_knowledge_base' AND "scope" = 'GLOBAL' AND "agencyId" IS NULL);


-- Verify:
-- SELECT "name", "priceMonthly", "listingPriority" FROM "Plan" ORDER BY "listingPriority";
-- SELECT "key", "enabled", "scope" FROM "FeatureFlag" ORDER BY "key";
-- SELECT "key" FROM "AdminSetting";

-- ============================================================================
-- SECTION 3 of 3 - Sample agencies, sample maids, sample reviews
-- ============================================================================
-- ============================================================================
-- FindMaids · 004 · SAMPLE agencies + maids (demonstration only)
-- Paste into the Supabase SQL Editor and run after 002 and 003.
--
-- What this creates (5 agencies, 15 maid profiles, 5 reviews):
--   * every agency row is tagged  adminNote = 'findmaids:sample-data'
--   * every maid row is tagged    isSample = true
--
-- Those markers do two things:
--   1. the app hides sample agencies and maids whenever it runs in production
--      (see lib/sample-data.ts), so they never appear on the live site even if
--      this file is still in the database;
--   2. supabase/009-remove-sample-data.sql deletes them in one transaction.
--
-- Names, phone numbers, e-mail addresses and maids are fictional. No real
-- licence numbers, people or availability are represented.
-- Idempotent: re-running only re-inserts nothing (ON CONFLICT DO NOTHING).
-- ============================================================================


INSERT INTO "Agency" (
  "id", "name", "slug", "description", "logoUrl", "bannerUrl", "licenseNumber",
  "yearEstablished", "address", "city", "province", "phone", "whatsapp", "email",
  "website", "facebook", "services", "serviceLocations", "nationalitiesServed",
  "languages", "status", "verifiedBadge", "adminNote", "profileCompleteness",
  "foundingAgency", "onboardingStep", "submittedAt", "verifiedAt",
  "createdAt", "updatedAt"
) VALUES
  (
    'sample-agency-harbourlight', 'Harbourlight Home Support', 'harbourlight-home-support',
    'Sample demonstration profile. Harbourlight Home Support illustrates how an approved agency profile looks: Filipino and Indonesian placements, newborn care support and a central-Singapore service area.',
    NULL, NULL, NULL, 2012, '1 Sample Road #02-10', 'Bukit Timah', 'Central Region',
    '+65 6000 1001', '+65 6000 1001', 'hello@harbourlight.example.test', NULL, NULL,
    ARRAY['Full-time placement', 'Newborn care'],
    ARRAY['Bukit Timah', 'Clementi', 'Singapore'],
    ARRAY['Filipino', 'Indonesian'],
    ARRAY['English', 'Tagalog', 'Bahasa Indonesia'],
    'APPROVED', true, 'findmaids:sample-data', 92, false, 6, NOW(), NOW(), NOW(), NOW()
  ),
  (
    'sample-agency-eastside', 'Eastside Family Care', 'eastside-family-care',
    'Sample demonstration profile. Eastside Family Care shows a Myanmar and Indian placement agency covering Tampines and the east region, including live-in arrangements.',
    NULL, NULL, NULL, 2015, '2 Sample Avenue #05-22', 'Tampines', 'East Region',
    '+65 6000 1002', NULL, 'hello@eastside.example.test', NULL, NULL,
    ARRAY['Full-time placement', 'Live-in placement'],
    ARRAY['Tampines', 'Pasir Ris', 'Singapore'],
    ARRAY['Myanmar', 'Indian'],
    ARRAY['English', 'Burmese', 'Tamil'],
    'APPROVED', true, 'findmaids:sample-data', 88, false, 6, NOW(), NOW(), NOW(), NOW()
  ),
  (
    'sample-agency-westhaven', 'Westhaven Home Services', 'westhaven-home-services',
    'Sample demonstration profile. Westhaven Home Services covers the west region with Filipino and Sri Lankan helpers and part-time household support.',
    NULL, NULL, NULL, 2016, '3 Sample Crescent #01-08', 'Jurong East', 'West Region',
    '+65 6000 1003', NULL, 'hello@westhaven.example.test', NULL, NULL,
    ARRAY['Part-time placement', 'Full-time placement'],
    ARRAY['Jurong East', 'Bukit Batok', 'Singapore'],
    ARRAY['Filipino', 'Sri Lankan'],
    ARRAY['English', 'Tagalog', 'Tamil'],
    'APPROVED', false, 'findmaids:sample-data', 81, false, 6, NOW(), NULL, NOW(), NOW()
  ),
  (
    'sample-agency-northpoint', 'Northpoint Family Support', 'northpoint-family-support',
    'Sample demonstration profile. Northpoint Family Support illustrates Indonesian and Filipino placements for families in Woodlands and the north region, including newborn care.',
    NULL, NULL, NULL, 2018, '4 Sample Street #03-15', 'Woodlands', 'North Region',
    '+65 6000 1004', '+65 6000 1004', 'hello@northpoint.example.test', NULL, NULL,
    ARRAY['Full-time placement', 'Newborn care'],
    ARRAY['Woodlands', 'Yishun', 'Singapore'],
    ARRAY['Indonesian', 'Filipino'],
    ARRAY['English', 'Bahasa Indonesia', 'Malay'],
    'APPROVED', true, 'findmaids:sample-data', 90, false, 6, NOW(), NOW(), NOW(), NOW()
  ),
  (
    'sample-agency-northeast', 'Northeast Home Partners', 'northeast-home-partners',
    'Sample demonstration profile. Northeast Home Partners shows a multi-nationality agency (Myanmar, Indian, Sri Lankan) serving Serangoon and the north-east region.',
    NULL, NULL, NULL, 2019, '5 Sample Link #02-04', 'Serangoon', 'North-East Region',
    '+65 6000 1005', NULL, 'hello@northeast.example.test', NULL, NULL,
    ARRAY['Live-in placement', 'Newborn care'],
    ARRAY['Serangoon', 'Hougang', 'Singapore'],
    ARRAY['Myanmar', 'Indian', 'Sri Lankan'],
    ARRAY['English', 'Burmese', 'Tamil'],
    'APPROVED', false, 'findmaids:sample-data', 84, false, 6, NOW(), NULL, NOW(), NOW()
  )
ON CONFLICT ("id") DO NOTHING;

-- Maid profiles (3 per agency, 15 total) ------------------------------------
INSERT INTO "Maid" ("id", "agencyId", "reference", "nationality", "age", "languages",
                    "placementType", "experienceYears", "duties", "monthlySalary",
                    "status", "availableFrom", "published", "isSample",
                    "createdAt", "updatedAt")
VALUES
  ('sample-maid-01', 'sample-agency-harbourlight', 'S-101', 'Filipino', 29,
   ARRAY['English', 'Tagalog'], 'Full-time placement', 4,
   ARRAY['Housekeeping', 'Meal preparation', 'Childcare support'], 620,
   'AVAILABLE', 'Mar 2026', true, true, NOW(), NOW()),
  ('sample-maid-02', 'sample-agency-harbourlight', 'S-102', 'Filipino', 34,
   ARRAY['English', 'Tagalog', 'Mandarin'], 'Newborn care', 7,
   ARRAY['Newborn care', 'Housekeeping'], 780,
   'ON_HOLD', 'Apr 2026', true, true, NOW(), NOW()),
  ('sample-maid-03', 'sample-agency-harbourlight', 'S-103', 'Indonesian', 31,
   ARRAY['English', 'Bahasa Indonesia'], 'Live-in placement', 6,
   ARRAY['Elder care support', 'Meal preparation'], 700,
   'AVAILABLE', 'Feb 2026', true, true, NOW(), NOW()),
  ('sample-maid-04', 'sample-agency-eastside', 'S-201', 'Myanmar', 27,
   ARRAY['English', 'Burmese'], 'Full-time placement', 3,
   ARRAY['Housekeeping', 'Childcare support'], 600,
   'AVAILABLE', 'Mar 2026', true, true, NOW(), NOW()),
  ('sample-maid-05', 'sample-agency-eastside', 'S-202', 'Indian', 33,
   ARRAY['English', 'Tamil'], 'Live-in placement', 5,
   ARRAY['Cooking', 'Housekeeping'], 650,
   'AVAILABLE', 'Feb 2026', true, true, NOW(), NOW()),
  ('sample-maid-06', 'sample-agency-eastside', 'S-203', 'Myanmar', 29,
   ARRAY['English', 'Burmese'], 'Live-in placement', 4,
   ARRAY['Elder care support', 'Meal preparation'], 630,
   'PLACED', 'Placed', true, true, NOW(), NOW()),
  ('sample-maid-07', 'sample-agency-westhaven', 'S-301', 'Filipino', 30,
   ARRAY['English', 'Tagalog'], 'Part-time placement', 5,
   ARRAY['Housekeeping', 'Meal preparation'], 660,
   'AVAILABLE', 'Mar 2026', true, true, NOW(), NOW()),
  ('sample-maid-08', 'sample-agency-westhaven', 'S-302', 'Sri Lankan', 32,
   ARRAY['English', 'Tamil'], 'Part-time placement', 4,
   ARRAY['Elder care support', 'Housekeeping'], 640,
   'AVAILABLE', 'Feb 2026', true, true, NOW(), NOW()),
  ('sample-maid-09', 'sample-agency-westhaven', 'S-303', 'Filipino', 26,
   ARRAY['English', 'Tagalog'], 'Full-time placement', 2,
   ARRAY['Childcare support', 'Housekeeping'], 590,
   'ON_HOLD', 'May 2026', true, true, NOW(), NOW()),
  ('sample-maid-10', 'sample-agency-northpoint', 'S-401', 'Indonesian', 28,
   ARRAY['English', 'Bahasa Indonesia', 'Malay'], 'Full-time placement', 5,
   ARRAY['Housekeeping', 'Childcare support'], 690,
   'AVAILABLE', 'Mar 2026', true, true, NOW(), NOW()),
  ('sample-maid-11', 'sample-agency-northpoint', 'S-402', 'Indonesian', 35,
   ARRAY['English', 'Bahasa Indonesia'], 'Newborn care', 8,
   ARRAY['Newborn care', 'Meal preparation'], 800,
   'AVAILABLE', 'Apr 2026', true, true, NOW(), NOW()),
  ('sample-maid-12', 'sample-agency-northpoint', 'S-403', 'Filipino', 31,
   ARRAY['English', 'Tagalog'], 'Full-time placement', 6,
   ARRAY['Housekeeping', 'Elder care support'], 720,
   'PLACED', 'Placed', true, true, NOW(), NOW()),
  ('sample-maid-13', 'sample-agency-northeast', 'S-501', 'Myanmar', 25,
   ARRAY['English', 'Burmese'], 'Live-in placement', 2,
   ARRAY['Housekeeping', 'Childcare support'], 580,
   'AVAILABLE', 'Mar 2026', true, true, NOW(), NOW()),
  ('sample-maid-14', 'sample-agency-northeast', 'S-502', 'Indian', 30,
   ARRAY['English', 'Tamil'], 'Newborn care', 5,
   ARRAY['Newborn care', 'Cooking'], 700,
   'ON_HOLD', 'Apr 2026', true, true, NOW(), NOW()),
  ('sample-maid-15', 'sample-agency-northeast', 'S-503', 'Sri Lankan', 34,
   ARRAY['English', 'Tamil'], 'Live-in placement', 7,
   ARRAY['Elder care support', 'Housekeeping'], 750,
   'AVAILABLE', 'Feb 2026', true, true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

-- Sample reviews so rated badges appear (one per agency) ---------------------
INSERT INTO "Review" ("id", "agencyId", "authorName", "rating", "title", "body",
                      "status", "createdAt", "updatedAt")
VALUES
  ('sample-review-01', 'sample-agency-harbourlight', 'Sample reviewer A', 5,
   'Sample review title', 'Fictional review used to show the review panel. No real employer is represented.', 'PUBLISHED', NOW(), NOW()),
  ('sample-review-02', 'sample-agency-eastside', 'Sample reviewer B', 4,
   'Sample review title', 'Fictional review used to show the review panel. No real employer is represented.', 'PUBLISHED', NOW(), NOW()),
  ('sample-review-03', 'sample-agency-westhaven', 'Sample reviewer C', 4,
   'Sample review title', 'Fictional review used to show the review panel. No real employer is represented.', 'PUBLISHED', NOW(), NOW()),
  ('sample-review-04', 'sample-agency-northpoint', 'Sample reviewer D', 5,
   'Sample review title', 'Fictional review used to show the review panel. No real employer is represented.', 'PUBLISHED', NOW(), NOW()),
  ('sample-review-05', 'sample-agency-northeast', 'Sample reviewer E', 4,
   'Sample review title', 'Fictional review used to show the review panel. No real employer is represented.', 'PUBLISHED', NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;


-- ============================================================================
-- Done. Verification queries (optional, run separately):
-- ============================================================================
COMMIT;

-- Expected: sample_agencies = 5, sample_maids = 15, plans = 3, flags = 4
-- SELECT COUNT(*) AS sample_agencies FROM "Agency" WHERE "adminNote" = 'findmaids:sample-data';
-- SELECT COUNT(*) AS sample_maids    FROM "Maid"   WHERE "isSample" = true;
-- SELECT "name", "priceMonthly", "listingPriority" FROM "Plan" ORDER BY "listingPriority";
-- SELECT "key", "enabled", "scope" FROM "FeatureFlag" ORDER BY "key";

-- ----------------------------------------------------------------------------
-- REMOVE THE SAMPLES LATER (uncomment and run, or use 009-remove-sample-data.sql)
-- ----------------------------------------------------------------------------
-- BEGIN;
-- DELETE FROM "Maid"   WHERE "isSample" = true;
-- DELETE FROM "Agency" WHERE "adminNote" = 'findmaids:sample-data';
-- COMMIT;