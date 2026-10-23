ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
ALTER TABLE "Enquiry"
  ADD COLUMN "consentAt" TIMESTAMP(3),
  ADD COLUMN "consentPolicyVersion" TEXT;

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

CREATE UNIQUE INDEX "CookieConsent_consentKeyHash_key" ON "CookieConsent"("consentKeyHash");
CREATE INDEX "CookieConsent_userId_capturedAt_idx" ON "CookieConsent"("userId", "capturedAt");
CREATE INDEX "CookieConsent_capturedAt_idx" ON "CookieConsent"("capturedAt");
CREATE INDEX "Agency_createdAt_idx" ON "Agency"("createdAt");
CREATE INDEX "Enquiry_agencyId_createdAt_idx" ON "Enquiry"("agencyId", "createdAt");
CREATE INDEX "AnalyticsEvent_agencyId_createdAt_idx" ON "AnalyticsEvent"("agencyId", "createdAt");
CREATE INDEX "KnowledgeDocument_embedding_hnsw_idx" ON "KnowledgeDocument" USING hnsw ("embedding" vector_cosine_ops);

ALTER TABLE "CookieConsent"
  ADD CONSTRAINT "CookieConsent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
