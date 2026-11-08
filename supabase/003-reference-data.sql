-- ============================================================================
-- FindMaids · 003 · Reference data (required by the running app)
-- Paste into the Supabase SQL Editor and run after 002.
--
-- Idempotent: plans are upserted by name, the FAQ setting by key, and feature
-- flags are only inserted when missing. No users, agencies or customer data are
-- created here.
-- ============================================================================

BEGIN;

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

COMMIT;

-- Verify:
-- SELECT "name", "priceMonthly", "listingPriority" FROM "Plan" ORDER BY "listingPriority";
-- SELECT "key", "enabled", "scope" FROM "FeatureFlag" ORDER BY "key";
-- SELECT "key" FROM "AdminSetting";
