-- CreateEnum
CREATE TYPE "MaidStatus" AS ENUM ('AVAILABLE', 'ON_HOLD', 'PLACED');

-- CreateTable
CREATE TABLE "Maid" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "nationality" TEXT NOT NULL,
    "age" INTEGER,
    "languages" TEXT[],
    "placementType" TEXT NOT NULL,
    "experienceYears" INTEGER,
    "duties" TEXT[],
    "monthlySalary" INTEGER,
    "status" "MaidStatus" NOT NULL DEFAULT 'AVAILABLE',
    "availableFrom" TEXT,
    "photoUrl" TEXT,
    "notes" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Maid_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Maid_agencyId_reference_key" ON "Maid"("agencyId", "reference");

-- CreateIndex
CREATE INDEX "Maid_agencyId_published_idx" ON "Maid"("agencyId", "published");

-- CreateIndex
CREATE INDEX "Maid_nationality_status_idx" ON "Maid"("nationality", "status");

-- AddForeignKey
ALTER TABLE "Maid" ADD CONSTRAINT "Maid_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Deny Supabase's public API access, matching 20261103000000_enable_rls.
ALTER TABLE "Maid" ENABLE ROW LEVEL SECURITY;
