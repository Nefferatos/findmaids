ALTER TYPE "AgencyStatus" ADD VALUE 'NEEDS_CHANGES';
ALTER TYPE "PaymentStatus" ADD VALUE 'EXPIRED';
ALTER TYPE "AdPlacementType" ADD VALUE 'CATEGORY_TOP';
CREATE TYPE "BillingPeriod" AS ENUM ('MONTHLY', 'YEARLY');

ALTER TABLE "Agency"
  ADD COLUMN "yearEstablished" INTEGER,
  ADD COLUMN "facebook" TEXT,
  ADD COLUMN "adminNote" TEXT,
  ADD COLUMN "profileCompleteness" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "onboardingStep" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "submittedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "notificationPreferences" JSONB;

ALTER TABLE "Subscription"
  ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "graceEndsAt" TIMESTAMP(3),
  ADD COLUMN "scheduledPlanId" TEXT,
  ADD COLUMN "downgradeEffectiveAt" TIMESTAMP(3),
  ADD COLUMN "billingPeriod" "BillingPeriod" NOT NULL DEFAULT 'MONTHLY';

ALTER TABLE "Payment"
  ADD COLUMN "checkoutRef" TEXT,
  ADD COLUMN "billingPeriod" "BillingPeriod" NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN "invoiceUrl" TEXT,
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "prorated" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Enquiry" ADD COLUMN "privateNotes" TEXT, ADD COLUMN "anonymizedAt" TIMESTAMP(3);
ALTER TABLE "Review"
  ADD COLUMN "agencyReply" TEXT,
  ADD COLUMN "agencyRepliedAt" TIMESTAMP(3),
  ADD COLUMN "reportedAt" TIMESTAMP(3),
  ADD COLUMN "reportReason" TEXT;

CREATE TABLE "PaymentWebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriptionNotice" (
  "id" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "noticeType" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionNotice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceSequence" (
  "year" INTEGER NOT NULL,
  "lastValue" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("year")
);

CREATE TABLE "DataDeletionRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "email" TEXT NOT NULL,
  "reason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DataDeletionRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgencyOnboardingDraft" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "data" JSONB NOT NULL DEFAULT '{}',
  "currentStep" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgencyOnboardingDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_eventId_key" ON "PaymentWebhookEvent"("provider", "eventId");
CREATE UNIQUE INDEX "SubscriptionNotice_subscriptionId_noticeType_key" ON "SubscriptionNotice"("subscriptionId", "noticeType");
CREATE INDEX "SubscriptionNotice_sentAt_idx" ON "SubscriptionNotice"("sentAt");
CREATE INDEX "PaymentWebhookEvent_eventType_processedAt_idx" ON "PaymentWebhookEvent"("eventType", "processedAt");
CREATE INDEX "DataDeletionRequest_status_createdAt_idx" ON "DataDeletionRequest"("status", "createdAt");
CREATE INDEX "DataDeletionRequest_email_idx" ON "DataDeletionRequest"("email");
CREATE UNIQUE INDEX "Agency_ownerId_key" ON "Agency"("ownerId");
CREATE UNIQUE INDEX "AgencyOnboardingDraft_userId_key" ON "AgencyOnboardingDraft"("userId");

ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_scheduledPlanId_fkey"
  FOREIGN KEY ("scheduledPlanId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DataDeletionRequest" ADD CONSTRAINT "DataDeletionRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgencyOnboardingDraft" ADD CONSTRAINT "AgencyOnboardingDraft_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
