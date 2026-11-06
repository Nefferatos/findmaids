ALTER TABLE "Payment"
  ALTER COLUMN "currency" SET DEFAULT 'SGD';

ALTER TABLE "Agency"
  ADD COLUMN "serviceLocations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Plan"
  RENAME COLUMN "aiMonthlyBudgetPhp" TO "aiMonthlyBudgetSgd";
