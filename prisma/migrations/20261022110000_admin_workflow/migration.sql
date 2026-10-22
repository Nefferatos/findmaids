ALTER TYPE "UserRole" ADD VALUE 'STAFF';
ALTER TYPE "AgencyStatus" ADD VALUE 'REJECTED';
ALTER TYPE "PaymentStatus" ADD VALUE 'PENDING_BANK_TRANSFER';
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIAL';
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED');

ALTER TABLE "User"
  ADD COLUMN "disabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "totpSecret" TEXT,
  ADD COLUMN "totpPendingSecret" TEXT,
  ADD COLUMN "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "totpVerifiedAt" TIMESTAMP(3);

ALTER TABLE "Agency"
  ADD COLUMN "rejectedAt" TIMESTAMP(3),
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "approvalChecklist" JSONB,
  ADD COLUMN "verifiedAt" TIMESTAMP(3),
  ADD COLUMN "verifiedById" TEXT;

ALTER TABLE "Payment"
  ADD COLUMN "bankReference" TEXT,
  ADD COLUMN "referenceCode" TEXT,
  ADD COLUMN "bankNotes" TEXT,
  ADD COLUMN "proofUrl" TEXT,
  ADD COLUMN "receivedAmount" DECIMAL(10,2),
  ADD COLUMN "receivedAt" TIMESTAMP(3),
  ADD COLUMN "reconciledById" TEXT,
  ADD COLUMN "reconciliationNote" TEXT,
  ADD COLUMN "refundAmount" DECIMAL(10,2),
  ADD COLUMN "refundReason" TEXT,
  ADD COLUMN "creditNoteNumber" TEXT;

ALTER TABLE "AuditLog"
  ADD COLUMN "before" JSONB,
  ADD COLUMN "after" JSONB,
  ADD COLUMN "ipAddress" TEXT;
ALTER TABLE "Review" ADD COLUMN "authorIpHash" TEXT;
ALTER TABLE "Review" ADD COLUMN "reviewerEmail" TEXT;
ALTER TABLE "Enquiry" ADD COLUMN "sourceIpHash" TEXT;

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

CREATE TABLE "AdminSetting" (
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminSetting_pkey" PRIMARY KEY ("key")
);

CREATE UNIQUE INDEX "Payment_referenceCode_key" ON "Payment"("referenceCode");
CREATE UNIQUE INDEX "Payment_creditNoteNumber_key" ON "Payment"("creditNoteNumber");
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");
CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");
CREATE INDEX "Report_agencyId_status_idx" ON "Report"("agencyId", "status");
CREATE UNIQUE INDEX "BlockList_valueHash_key" ON "BlockList"("valueHash");
CREATE INDEX "BlockList_type_active_idx" ON "BlockList"("type", "active");
CREATE INDEX "AdminSetting_updatedById_idx" ON "AdminSetting"("updatedById");

ALTER TABLE "Agency" ADD CONSTRAINT "Agency_verifiedById_fkey"
  FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reconciledById_fkey"
  FOREIGN KEY ("reconciledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_resolvedById_fkey"
  FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
