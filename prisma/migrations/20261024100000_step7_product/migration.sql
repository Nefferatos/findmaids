CREATE TYPE "ProspectStage" AS ENUM ('IDENTIFIED', 'CONTACTED', 'INTERESTED', 'PROFILE_DRAFTED', 'LISTED_FREE', 'TRIAL', 'PAYING', 'DECLINED', 'DO_NOT_CONTACT');

ALTER TABLE "Enquiry"
  ADD COLUMN "firstRespondedAt" TIMESTAMP(3),
  ADD COLUMN "acquisitionSource" JSONB;

ALTER TABLE "Agency"
  ADD COLUMN "foundingAgency" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "foundingPeriodStartsAt" TIMESTAMP(3),
  ADD COLUMN "foundingPeriodEndsAt" TIMESTAMP(3);

ALTER TABLE "Subscription"
  ADD COLUMN "foundingAgency" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "foundingPeriodStartsAt" TIMESTAMP(3),
  ADD COLUMN "foundingPeriodEndsAt" TIMESTAMP(3);

ALTER TABLE "AdPlacement" ADD COLUMN "foundingGrant" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Enquiry_agencyId_firstRespondedAt_idx" ON "Enquiry"("agencyId", "firstRespondedAt");
CREATE INDEX "Enquiry_firstRespondedAt_createdAt_idx" ON "Enquiry"("firstRespondedAt", "createdAt");
CREATE INDEX "AnalyticsEvent_type_createdAt_idx" ON "AnalyticsEvent"("type", "createdAt");

CREATE TABLE "Prospect" (
  "id" TEXT NOT NULL,
  "agencyName" TEXT NOT NULL,
  "contactName" TEXT,
  "phone" TEXT,
  "whatsapp" TEXT,
  "email" TEXT,
  "city" TEXT NOT NULL,
  "licenseNumber" TEXT,
  "licenseCheckedAt" TIMESTAMP(3),
  "licenseSource" TEXT,
  "contactDetailsSource" TEXT NOT NULL,
  "stage" "ProspectStage" NOT NULL DEFAULT 'IDENTIFIED',
  "source" TEXT NOT NULL,
  "notes" TEXT,
  "lastContactedAt" TIMESTAMP(3),
  "nextActionAt" TIMESTAMP(3),
  "ownerUserId" TEXT,
  "agencyId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Prospect_stage_nextActionAt_idx" ON "Prospect"("stage", "nextActionAt");
CREATE INDEX "Prospect_city_stage_idx" ON "Prospect"("city", "stage");
CREATE INDEX "Prospect_agencyId_idx" ON "Prospect"("agencyId");
CREATE INDEX "Prospect_ownerUserId_stage_idx" ON "Prospect"("ownerUserId", "stage");
CREATE INDEX "Prospect_email_idx" ON "Prospect"("email");

ALTER TABLE "Prospect"
  ADD CONSTRAINT "Prospect_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Prospect_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
