import { PrismaClient, ProspectStage } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import { assertStagingWriteAllowed } from "../lib/security/staging-guard";
import { encryptTotpSecret } from "../lib/totp";

// Staging-only: refuses to run unless APP_ENV is staging/test and STAGING_PROJECT_REF matches both URLs.
assertStagingWriteAllowed();
const password = process.env.E2E_TEST_PASSWORD;
const totpSecret = process.env.E2E_ADMIN_TOTP_SECRET;
if (!password || !totpSecret) throw new Error("E2E_TEST_PASSWORD and E2E_ADMIN_TOTP_SECRET are required.");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL, max: 1 }),
});
const day = 86_400_000;
const now = new Date();
const inDays = (n: number) => new Date(now.getTime() + n * day);

const plans = [
  { name: "Basic Free", priceMonthly: 0, priceYearly: 0, listingPriority: 0, featuredSlots: 0, maxPhotos: 3,
    // Staging dry run only: a monthly allowance of 2 so the cap is reached quickly.
    leadLimit: 2, aiMonthlyBudgetSgd: 0, features: ["Agency profile", "Up to 3 photos", "2 enquiries per month (staging test)"] },
  { name: "Gold", priceMonthly: 999, priceYearly: 9990, listingPriority: 10, featuredSlots: 1, maxPhotos: 10,
    leadLimit: 100, aiMonthlyBudgetSgd: 50, features: ["Enhanced profile", "Up to 10 photos", "Priority listing"] },
  { name: "Platinum", priceMonthly: 1999, priceYearly: 19990, listingPriority: 20, featuredSlots: 1, maxPhotos: 25,
    leadLimit: null, aiMonthlyBudgetSgd: 150, features: ["Premium profile", "Up to 25 photos", "Homepage banner", "Featured card", "Category top placement"] },
];

const agencies = [
  { key: "a", name: "TEST Agency A (Basic)", plan: "Basic Free" },
  { key: "b", name: "TEST Agency B (Founding)", plan: "Gold" },
  { key: "c", name: "TEST Agency C (Gold paid)", plan: "Gold" },
] as const;

async function main() {
  const planIds: Record<string, string> = {};
  for (const plan of plans) {
    const saved = await prisma.plan.upsert({ where: { name: plan.name }, create: plan, update: plan });
    planIds[plan.name] = saved.id;
  }
  const passwordHash = await hash(password!, 10);
  const user = (email: string, name: string, role: "ADMIN" | "STAFF" | "AGENCY", extra = {}) =>
    prisma.user.upsert({
      where: { email },
      create: { email, name, role, passwordHash, emailVerified: now, ...extra },
      update: { name, role, passwordHash, emailVerified: now, disabled: false, ...extra },
    });

  await user("admin@example.test", "TEST Admin", "ADMIN", {
    totpEnabled: true,
    totpVerifiedAt: now,
    totpSecret: encryptTotpSecret(`${totpSecret}|admin@example.test`),
  });
  await user("staff@example.test", "TEST Staff", "STAFF");

  for (const [index, spec] of agencies.entries()) {
    const owner = await user(`agency-${spec.key}@example.test`, `TEST Owner ${spec.key.toUpperCase()}`, "AGENCY");
    const founding = spec.key === "b";
    const data = {
      name: spec.name,
      description: "Fictional agency created by the staging seed for dry-run testing only. Not a real business.",
      licenseNumber: `TEST-${spec.key.toUpperCase()}-0001`,
      yearEstablished: 2015,
      address: `${10 + index} Test Street`,
      city: "Singapore",
      province: "Singapore",
      phone: `+65 5550 000${index + 1}`,
      whatsapp: null,
      email: `agency-${spec.key}@example.test`,
      services: ["Full-time placement"],
      serviceLocations: ["Singapore"],
      nationalitiesServed: ["Filipino"],
      languages: ["English"],
      status: "APPROVED" as const,
      verifiedBadge: false,
      profileCompleteness: 90,
      foundingAgency: founding,
      foundingPeriodStartsAt: founding ? inDays(-87) : null,
      foundingPeriodEndsAt: founding ? inDays(3) : null,
      ownerId: owner.id,
    };
    const agency = await prisma.agency.upsert({
      where: { slug: `test-agency-${spec.key}` },
      create: { slug: `test-agency-${spec.key}`, ...data },
      update: data,
    });
    const subId = `staging-sub-${spec.key}`;
    const subData = {
      agencyId: agency.id,
      planId: planIds[spec.plan],
      status: "ACTIVE" as const,
      startDate: founding ? inDays(-87) : inDays(-5),
      endDate: founding ? inDays(3) : spec.key === "c" ? inDays(25) : null,
      foundingAgency: founding,
      foundingPeriodStartsAt: founding ? inDays(-87) : null,
      foundingPeriodEndsAt: founding ? inDays(3) : null,
    };
    await prisma.subscription.upsert({ where: { id: subId }, create: { id: subId, ...subData }, update: subData });
    if (founding)
      await prisma.adPlacement.upsert({
        where: { id: "staging-placement-b" },
        create: { id: "staging-placement-b", agencyId: agency.id, type: "FEATURED", startDate: inDays(-87), endDate: inDays(3), status: "ACTIVE", foundingGrant: true },
        update: { startDate: inDays(-87), endDate: inDays(3), status: "ACTIVE", foundingGrant: true },
      });
    if (spec.key === "c") {
      const pay = { subscriptionId: subId, amount: 999, currency: "SGD", status: "PAID" as const, paidAt: inDays(-5), billingPeriod: "MONTHLY" as const };
      await prisma.payment.upsert({ where: { invoiceNumber: "TEST-INV-0001" }, create: { invoiceNumber: "TEST-INV-0001", ...pay }, update: pay });
    }
    const prospects = [
      { id: `staging-prospect-${spec.key}-contacted`, stage: "CONTACTED" as ProspectStage, label: "Contacted" },
      { id: `staging-prospect-${spec.key}-dnc`, stage: "DO_NOT_CONTACT" as ProspectStage, label: "Do not contact" },
    ];
    for (const p of prospects) {
      const pd = {
        agencyName: `TEST Prospect ${spec.key.toUpperCase()} ${p.label}`,
        contactName: "Test Contact",
        email: `prospect-${spec.key}-${p.stage.toLowerCase()}@example.test`,
        city: "Singapore",
        licenseNumber: `TEST-P-${spec.key.toUpperCase()}-${p.stage === "CONTACTED" ? "1" : "2"}`,
        contactDetailsSource: "Fictional staging seed data",
        stage: p.stage,
        source: "staging-seed",
        lastContactedAt: p.stage === "CONTACTED" ? inDays(-2) : null,
      };
      await prisma.prospect.upsert({ where: { id: p.id }, create: { id: p.id, ...pd }, update: pd });
    }
  }
  console.log("Seeded staging: 3 plans, 5 users (admin, staff, 3 owners), 3 agencies, 3 subscriptions, 1 payment, 1 founding placement, 6 prospects.");
}

main()
  .catch((e: unknown) => {
    console.error("Staging seed failed:", e instanceof Error ? e.message.split("\n").filter((l) => l.trim()).slice(0, 3).join(" | ") : "unknown");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
