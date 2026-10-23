ALTER TABLE "Plan" ADD COLUMN "aiMonthlyBudgetPhp" DECIMAL(10,2);

ALTER TABLE "Enquiry"
  ADD COLUMN "aiSummary" TEXT,
  ADD COLUMN "aiHelperType" TEXT,
  ADD COLUMN "aiLocation" TEXT,
  ADD COLUMN "aiBudgetText" TEXT,
  ADD COLUMN "aiStartDateText" TEXT,
  ADD COLUMN "aiUrgency" TEXT,
  ADD COLUMN "aiQualityScore" INTEGER,
  ADD COLUMN "aiQualityReasons" JSONB,
  ADD COLUMN "aiSpamProbability" DOUBLE PRECISION,
  ADD COLUMN "aiReplyDraft" TEXT,
  ADD COLUMN "aiReplyApprovedAt" TIMESTAMP(3),
  ADD COLUMN "aiReplySentAt" TIMESTAMP(3);

ALTER TABLE "Conversation"
  ADD COLUMN "visitorTokenHash" TEXT,
  ADD COLUMN "consentAt" TIMESTAMP(3),
  ADD COLUMN "retentionExpiresAt" TIMESTAMP(3),
  ADD COLUMN "language" TEXT,
  ADD COLUMN "sourceIpHash" TEXT;

ALTER TABLE "AgencyAiSettings" ADD COLUMN "replyMode" TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "Message" ADD COLUMN "providerMessageId" TEXT;

CREATE UNIQUE INDEX "Conversation_visitorTokenHash_key" ON "Conversation"("visitorTokenHash");
CREATE INDEX "Conversation_retentionExpiresAt_idx" ON "Conversation"("retentionExpiresAt");
CREATE INDEX "Enquiry_aiQualityScore_createdAt_idx" ON "Enquiry"("aiQualityScore", "createdAt");
CREATE INDEX "Enquiry_aiSpamProbability_createdAt_idx" ON "Enquiry"("aiSpamProbability", "createdAt");
CREATE UNIQUE INDEX "Message_providerMessageId_key" ON "Message"("providerMessageId");
