import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const confirmation = "SEED_REVIEWED_CATALOG_ONLY";

async function main() {
  if (process.env.CONFIRM_PRODUCTION_CATALOG_SEED !== confirmation)
    throw new Error(
      `Set CONFIRM_PRODUCTION_CATALOG_SEED=${confirmation} after reviewing plan prices and FAQ text.`,
    );
  if (process.env.NODE_ENV !== "production")
    throw new Error(
      "This script is intended for a controlled production catalog seed; use prisma/seed.ts for isolated local test data.",
    );

  const plans = [
    {
      name: "Basic Free",
      priceMonthly: 0,
      priceYearly: 0,
      listingPriority: 0,
      featuredSlots: 0,
      maxPhotos: 3,
      leadLimit: 10,
      aiMonthlyBudgetPhp: 0,
      features: ["Agency profile", "Up to 3 photos", "10 enquiries per month"],
    },
    {
      name: "Gold",
      priceMonthly: 999,
      priceYearly: 9990,
      listingPriority: 10,
      featuredSlots: 1,
      maxPhotos: 10,
      leadLimit: 100,
      aiMonthlyBudgetPhp: 50,
      features: ["Enhanced profile", "Up to 10 photos", "Priority listing"],
    },
    {
      name: "Platinum",
      priceMonthly: 1999,
      priceYearly: 19990,
      listingPriority: 20,
      featuredSlots: 1,
      maxPhotos: 25,
      leadLimit: null,
      aiMonthlyBudgetPhp: 150,
      features: [
        "Premium profile",
        "Up to 25 photos",
        "Homepage banner",
        "Featured card",
        "Category top placement",
      ],
    },
  ];
  for (const plan of plans)
    await prisma.plan.upsert({
      where: { name: plan.name },
      create: plan,
      update: plan,
    });

  const entries = [
    {
      question: "Does FindMaids recruit or employ domestic workers?",
      answer:
        "No. FindMaids is a directory and advertising platform. Agencies are independent third parties.",
    },
    {
      question: "Are agency listings guaranteed or endorsed?",
      answer:
        "No. A profile, verification indicator, or sponsored placement is not a guarantee or endorsement. Verify agency credentials and terms directly.",
    },
    {
      question: "How do I contact an agency?",
      answer:
        "Open an approved agency profile and use its contact information or submit the enquiry form.",
    },
    {
      question: "How are reviews displayed?",
      answer:
        "Reviews remain pending until moderated. Only published reviews appear on profiles.",
    },
  ];
  await prisma.adminSetting.upsert({
    where: { key: "platformFaq" },
    create: { key: "platformFaq", value: { entries } },
    update: { value: { entries } },
  });
  console.info(
    `Seeded/updated ${plans.length} reviewed plans and ${entries.length} platform FAQs. No users, agencies, or enquiries were created.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Catalog seed failed.",
    );
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
