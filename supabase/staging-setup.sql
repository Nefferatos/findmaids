-- FindMaids STAGING database setup (Supabase project ref: tajpujqabclbxoggkxse).
-- Paste into the Supabase SQL Editor and run ONCE on an EMPTY project.
--
-- Contents, in order:
--   1. pgvector extension
--   2. Tables, enums, indexes and foreign keys generated from prisma/schema.prisma
--      (`prisma migrate diff --from-empty`), plus the hand-written HNSW vector index
--      from migration 20261023090000_launch_hardening
--   3. Row Level Security enabled on every table, with NO policies: the public
--      Supabase API (anon / authenticated) cannot read or write app data. The app
--      connects with the server-side database role, which bypasses RLS.
--   4. Storage buckets findmaids-media (public) and findmaids-private (private)
--      with size and type limits, plus storage policies
--
-- No seed data, passwords, keys or contact details are included.
-- Everything runs in one transaction: if any statement fails, nothing is changed.
-- If run a second time, the guard below raises an exception, the transaction rolls
-- back, and nothing is changed.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public."User"') IS NOT NULL THEN
    RAISE EXCEPTION 'FindMaids schema already exists. Nothing was changed.';
  END IF;
END $$;

-- 1. Extension (Supabase keeps extensions in the "extensions" schema)
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 2. Schema generated from prisma/schema.prisma
-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('VISITOR', 'AGENCY', 'STAFF', 'ADMIN');

-- CreateEnum
CREATE TYPE "AgencyStatus" AS ENUM ('PENDING', 'APPROVED', 'NEEDS_CHANGES', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PENDING_BANK_TRANSFER', 'PARTIAL', 'PAID', 'FAILED', 'REFUNDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "AdPlacementType" AS ENUM ('FEATURED', 'HOMEPAGE', 'SEARCH', 'CATEGORY_TOP');

-- CreateEnum
CREATE TYPE "AdPlacementStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EnquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "EnquirySource" AS ENUM ('WEB', 'CHAT', 'WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'PUBLISHED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ConversationChannel" AS ENUM ('WEB', 'WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'HANDED_OFF', 'CLOSED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM', 'TOOL');

-- CreateEnum
CREATE TYPE "FeatureFlagScope" AS ENUM ('GLOBAL', 'AGENCY');

-- CreateEnum
CREATE TYPE "HandoffStatus" AS ENUM ('OPEN', 'ACCEPTED', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProspectStage" AS ENUM ('IDENTIFIED', 'CONTACTED', 'INTERESTED', 'PROFILE_DRAFTED', 'LISTED_FREE', 'TRIAL', 'PAYING', 'DECLINED', 'DO_NOT_CONTACT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'VISITOR',
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "totpSecret" TEXT,
    "totpPendingSecret" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "totpVerifiedAt" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "notificationPreferences" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agency" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "logoUrl" TEXT,
    "bannerUrl" TEXT,
    "licenseNumber" TEXT,
    "yearEstablished" INTEGER,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "whatsapp" TEXT,
    "email" TEXT NOT NULL,
    "website" TEXT,
    "facebook" TEXT,
    "services" TEXT[],
    "serviceLocations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "nationalitiesServed" TEXT[],
    "languages" TEXT[],
    "status" "AgencyStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedBadge" BOOLEAN NOT NULL DEFAULT false,
    "adminNote" TEXT,
    "profileCompleteness" INTEGER NOT NULL DEFAULT 0,
    "foundingAgency" BOOLEAN NOT NULL DEFAULT false,
    "foundingPeriodStartsAt" TIMESTAMP(3),
    "foundingPeriodEndsAt" TIMESTAMP(3),
    "onboardingStep" INTEGER NOT NULL DEFAULT 1,
    "submittedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "approvalChecklist" JSONB,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyOnboardingDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyOnboardingDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyPhoto" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceMonthly" DECIMAL(10,2) NOT NULL,
    "priceYearly" DECIMAL(10,2) NOT NULL,
    "features" JSONB NOT NULL,
    "listingPriority" INTEGER NOT NULL DEFAULT 0,
    "featuredSlots" INTEGER NOT NULL DEFAULT 0,
    "maxPhotos" INTEGER NOT NULL DEFAULT 5,
    "leadLimit" INTEGER,
    "aiMonthlyBudgetSgd" DECIMAL(10,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "graceEndsAt" TIMESTAMP(3),
    "scheduledPlanId" TEXT,
    "downgradeEffectiveAt" TIMESTAMP(3),
    "foundingAgency" BOOLEAN NOT NULL DEFAULT false,
    "foundingPeriodStartsAt" TIMESTAMP(3),
    "foundingPeriodEndsAt" TIMESTAMP(3),
    "billingPeriod" "BillingPeriod" NOT NULL DEFAULT 'MONTHLY',
    "providerRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'SGD',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL,
    "providerRef" TEXT,
    "checkoutRef" TEXT,
    "billingPeriod" "BillingPeriod" NOT NULL DEFAULT 'MONTHLY',
    "invoiceUrl" TEXT,
    "expiresAt" TIMESTAMP(3),
    "prorated" BOOLEAN NOT NULL DEFAULT false,
    "bankReference" TEXT,
    "referenceCode" TEXT,
    "bankNotes" TEXT,
    "proofUrl" TEXT,
    "receivedAmount" DECIMAL(10,2),
    "receivedAt" TIMESTAMP(3),
    "reconciledById" TEXT,
    "reconciliationNote" TEXT,
    "refundAmount" DECIMAL(10,2),
    "refundReason" TEXT,
    "creditNoteNumber" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdPlacement" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "type" "AdPlacementType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "AdPlacementStatus" NOT NULL DEFAULT 'SCHEDULED',
    "foundingGrant" BOOLEAN NOT NULL DEFAULT false,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enquiry" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "message" TEXT NOT NULL,
    "preferredStartDate" TIMESTAMP(3),
    "budget" DECIMAL(10,2),
    "status" "EnquiryStatus" NOT NULL DEFAULT 'NEW',
    "firstRespondedAt" TIMESTAMP(3),
    "acquisitionSource" JSONB,
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "consentAt" TIMESTAMP(3),
    "consentPolicyVersion" TEXT,
    "privateNotes" TEXT,
    "anonymizedAt" TIMESTAMP(3),
    "sourceIpHash" TEXT,
    "aiSummary" TEXT,
    "aiHelperType" TEXT,
    "aiLocation" TEXT,
    "aiBudgetText" TEXT,
    "aiStartDateText" TEXT,
    "aiUrgency" TEXT,
    "aiQualityScore" INTEGER,
    "aiQualityReasons" JSONB,
    "aiSpamProbability" DOUBLE PRECISION,
    "aiReplyDraft" TEXT,
    "aiReplyApprovedAt" TIMESTAMP(3),
    "aiReplySentAt" TIMESTAMP(3),
    "source" "EnquirySource" NOT NULL DEFAULT 'WEB',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "reviewerEmail" TEXT,
    "authorIpHash" TEXT,
    "rating" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "agencyReply" TEXT,
    "agencyRepliedAt" TIMESTAMP(3),
    "reportedAt" TIMESTAMP(3),
    "reportReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "type" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "agencyId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT,
    "agencyId" TEXT,
    "reviewId" TEXT,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionNote" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockList" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "valueHash" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlockList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "channel" "ConversationChannel" NOT NULL,
    "userId" TEXT,
    "agencyId" TEXT,
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "visitorTokenHash" TEXT,
    "consentAt" TIMESTAMP(3),
    "retentionExpiresAt" TIMESTAMP(3),
    "language" TEXT,
    "sourceIpHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "providerMessageId" TEXT,
    "content" TEXT NOT NULL,
    "tokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiCallLog" (
    "id" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "costEstimate" DECIMAL(12,6),
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "userId" TEXT,
    "agencyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "scope" "FeatureFlagScope" NOT NULL DEFAULT 'GLOBAL',
    "agencyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyAiSettings" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "autoReplyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "replyMode" TEXT NOT NULL DEFAULT 'DRAFT',
    "replyTone" TEXT NOT NULL DEFAULT 'professional',
    "businessHours" JSONB,
    "languages" TEXT[],
    "escalationEmail" TEXT,
    "knowledgeBase" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyAiSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiFeedback" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandoffRequest" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "HandoffStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HandoffRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "SubscriptionNotice" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "noticeType" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceSequence" (
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("year")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "CookieConsent" (
    "id" TEXT NOT NULL,
    "consentKeyHash" TEXT NOT NULL,
    "userId" TEXT,
    "policyVersion" TEXT NOT NULL,
    "analytics" BOOLEAN NOT NULL DEFAULT false,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CookieConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Agency_slug_key" ON "Agency"("slug");

-- CreateIndex
CREATE INDEX "Agency_city_province_status_idx" ON "Agency"("city", "province", "status");

-- CreateIndex
CREATE INDEX "Agency_status_verifiedBadge_idx" ON "Agency"("status", "verifiedBadge");

-- CreateIndex
CREATE INDEX "Agency_createdAt_idx" ON "Agency"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Agency_ownerId_key" ON "Agency"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "AgencyOnboardingDraft_userId_key" ON "AgencyOnboardingDraft"("userId");

-- CreateIndex
CREATE INDEX "AgencyPhoto_agencyId_sortOrder_idx" ON "AgencyPhoto"("agencyId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");

-- CreateIndex
CREATE INDEX "Plan_isActive_listingPriority_idx" ON "Plan"("isActive", "listingPriority");

-- CreateIndex
CREATE INDEX "Subscription_agencyId_status_idx" ON "Subscription"("agencyId", "status");

-- CreateIndex
CREATE INDEX "Subscription_planId_status_idx" ON "Subscription"("planId", "status");

-- CreateIndex
CREATE INDEX "Subscription_endDate_idx" ON "Subscription"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_referenceCode_key" ON "Payment"("referenceCode");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_invoiceNumber_key" ON "Payment"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Payment_subscriptionId_status_idx" ON "Payment"("subscriptionId", "status");

-- CreateIndex
CREATE INDEX "Payment_provider_providerRef_idx" ON "Payment"("provider", "providerRef");

-- CreateIndex
CREATE INDEX "AdPlacement_agencyId_status_startDate_endDate_idx" ON "AdPlacement"("agencyId", "status", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "AdPlacement_type_status_idx" ON "AdPlacement"("type", "status");

-- CreateIndex
CREATE INDEX "Enquiry_agencyId_status_createdAt_idx" ON "Enquiry"("agencyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Enquiry_email_idx" ON "Enquiry"("email");

-- CreateIndex
CREATE INDEX "Enquiry_agencyId_createdAt_idx" ON "Enquiry"("agencyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_expiresAt_idx" ON "EmailVerificationToken"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");

-- CreateIndex
CREATE INDEX "Review_agencyId_status_createdAt_idx" ON "Review"("agencyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_agencyId_type_createdAt_idx" ON "AnalyticsEvent"("agencyId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_agencyId_createdAt_idx" ON "AnalyticsEvent"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_type_createdAt_idx" ON "AnalyticsEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_agencyId_createdAt_idx" ON "AuditLog"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "Report_agencyId_status_idx" ON "Report"("agencyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BlockList_valueHash_key" ON "BlockList"("valueHash");

-- CreateIndex
CREATE INDEX "BlockList_type_active_idx" ON "BlockList"("type", "active");

-- CreateIndex
CREATE INDEX "AdminSetting_updatedById_idx" ON "AdminSetting"("updatedById");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_visitorTokenHash_key" ON "Conversation"("visitorTokenHash");

-- CreateIndex
CREATE INDEX "Conversation_channel_status_createdAt_idx" ON "Conversation"("channel", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Conversation_userId_status_idx" ON "Conversation"("userId", "status");

-- CreateIndex
CREATE INDEX "Conversation_agencyId_status_idx" ON "Conversation"("agencyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Message_providerMessageId_key" ON "Message"("providerMessageId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "AiCallLog_feature_status_createdAt_idx" ON "AiCallLog"("feature", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AiCallLog_userId_createdAt_idx" ON "AiCallLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiCallLog_agencyId_createdAt_idx" ON "AiCallLog"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "FeatureFlag_key_scope_enabled_idx" ON "FeatureFlag"("key", "scope", "enabled");

-- CreateIndex
CREATE INDEX "FeatureFlag_agencyId_idx" ON "FeatureFlag"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_scope_agencyId_key" ON "FeatureFlag"("key", "scope", "agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "AgencyAiSettings_agencyId_key" ON "AgencyAiSettings"("agencyId");

-- CreateIndex
CREATE INDEX "AgencyAiSettings_autoReplyEnabled_idx" ON "AgencyAiSettings"("autoReplyEnabled");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_agencyId_idx" ON "KnowledgeDocument"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "AiFeedback_messageId_key" ON "AiFeedback"("messageId");

-- CreateIndex
CREATE INDEX "AiFeedback_rating_createdAt_idx" ON "AiFeedback"("rating", "createdAt");

-- CreateIndex
CREATE INDEX "HandoffRequest_conversationId_status_idx" ON "HandoffRequest"("conversationId", "status");

-- CreateIndex
CREATE INDEX "HandoffRequest_status_createdAt_idx" ON "HandoffRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_eventType_processedAt_idx" ON "PaymentWebhookEvent"("eventType", "processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_eventId_key" ON "PaymentWebhookEvent"("provider", "eventId");

-- CreateIndex
CREATE INDEX "SubscriptionNotice_sentAt_idx" ON "SubscriptionNotice"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionNotice_subscriptionId_noticeType_key" ON "SubscriptionNotice"("subscriptionId", "noticeType");

-- CreateIndex
CREATE INDEX "DataDeletionRequest_status_createdAt_idx" ON "DataDeletionRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "DataDeletionRequest_email_idx" ON "DataDeletionRequest"("email");

-- CreateIndex
CREATE INDEX "Prospect_stage_nextActionAt_idx" ON "Prospect"("stage", "nextActionAt");

-- CreateIndex
CREATE INDEX "Prospect_city_stage_idx" ON "Prospect"("city", "stage");

-- CreateIndex
CREATE INDEX "Prospect_agencyId_idx" ON "Prospect"("agencyId");

-- CreateIndex
CREATE INDEX "Prospect_ownerUserId_stage_idx" ON "Prospect"("ownerUserId", "stage");

-- CreateIndex
CREATE INDEX "Prospect_email_idx" ON "Prospect"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CookieConsent_consentKeyHash_key" ON "CookieConsent"("consentKeyHash");

-- CreateIndex
CREATE INDEX "CookieConsent_userId_capturedAt_idx" ON "CookieConsent"("userId", "capturedAt");

-- CreateIndex
CREATE INDEX "CookieConsent_capturedAt_idx" ON "CookieConsent"("capturedAt");

-- AddForeignKey
ALTER TABLE "Agency" ADD CONSTRAINT "Agency_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agency" ADD CONSTRAINT "Agency_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyOnboardingDraft" ADD CONSTRAINT "AgencyOnboardingDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyPhoto" ADD CONSTRAINT "AgencyPhoto_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_scheduledPlanId_fkey" FOREIGN KEY ("scheduledPlanId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reconciledById_fkey" FOREIGN KEY ("reconciledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdPlacement" ADD CONSTRAINT "AdPlacement_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCallLog" ADD CONSTRAINT "AiCallLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCallLog" ADD CONSTRAINT "AiCallLog_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureFlag" ADD CONSTRAINT "FeatureFlag_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyAiSettings" ADD CONSTRAINT "AgencyAiSettings_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiFeedback" ADD CONSTRAINT "AiFeedback_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoffRequest" ADD CONSTRAINT "HandoffRequest_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataDeletionRequest" ADD CONSTRAINT "DataDeletionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CookieConsent" ADD CONSTRAINT "CookieConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Hand-written index from migration 20261023090000_launch_hardening (not produced by schema diff)
CREATE INDEX "KnowledgeDocument_embedding_hnsw_idx" ON "KnowledgeDocument" USING hnsw ("embedding" vector_cosine_ops);

-- 3. Row Level Security: enabled on every table, no policies (deny all for API roles)
ALTER TABLE public."AdminSetting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AdPlacement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Agency" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AgencyAiSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AgencyOnboardingDraft" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AgencyPhoto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AiCallLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AiFeedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AnalyticsEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BlockList" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Conversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CookieConsent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DataDeletionRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EmailVerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Enquiry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."FeatureFlag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HandoffRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."InvoiceSequence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."KnowledgeDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PasswordResetToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PaymentWebhookEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Plan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Prospect" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RateLimitBucket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Report" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Review" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SubscriptionNotice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;

-- 4. Storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('findmaids-media', 'findmaids-media', true, 5242880,
   ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('findmaids-private', 'findmaids-private', false, 10485760,
   ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies. RLS is already on for storage.objects; with no permissive write
-- policy, uploads are denied. The restrictive policies below make that explicit and
-- keep it denied even if a permissive policy is added later. The service role used
-- by the app bypasses RLS.
DROP POLICY IF EXISTS "findmaids_public_read_media" ON storage.objects;
CREATE POLICY "findmaids_public_read_media" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'findmaids-media');

DROP POLICY IF EXISTS "findmaids_deny_client_insert" ON storage.objects;
CREATE POLICY "findmaids_deny_client_insert" ON storage.objects
  AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id NOT IN ('findmaids-media', 'findmaids-private'));

DROP POLICY IF EXISTS "findmaids_deny_client_update" ON storage.objects;
CREATE POLICY "findmaids_deny_client_update" ON storage.objects
  AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (bucket_id NOT IN ('findmaids-media', 'findmaids-private'));

DROP POLICY IF EXISTS "findmaids_deny_client_delete" ON storage.objects;
CREATE POLICY "findmaids_deny_client_delete" ON storage.objects
  AS RESTRICTIVE FOR DELETE TO anon, authenticated
  USING (bucket_id NOT IN ('findmaids-media', 'findmaids-private'));

DROP POLICY IF EXISTS "findmaids_deny_client_read_private" ON storage.objects;
CREATE POLICY "findmaids_deny_client_read_private" ON storage.objects
  AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (bucket_id <> 'findmaids-private');

COMMIT;

-- Verification (run separately after COMMIT):
-- SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
-- FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY c.relname;
