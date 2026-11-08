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
