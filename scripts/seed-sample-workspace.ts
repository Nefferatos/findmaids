/**
 * Seeds the SAMPLE agency workspace so the real `/agency/dashboard` can be
 * demonstrated with data: an agency-owner login, a plan, leads and analytics.
 *
 * Prerequisites (paste into Supabase first — see supabase/README.md):
 *   supabase/ALL-IN-ONE-sample-setup.sql   (or 002 + 003 + 004)
 *   It creates the sample agency "Harbourlight Home Support" this script attaches
 *   an owner to. If that agency is missing the script stops and tells you.
 *
 * Usage (local / preview databases only):
 *   npm run seed:sample-workspace
 *
 * Optional environment overrides:
 *   SAMPLE_AGENCY_EMAIL     (default sample.owner@findmaids.test)
 *   SAMPLE_AGENCY_PASSWORD  (default printed below)
 *
 * Remove everything again:
 *   supabase/009-remove-sample-data.sql  plus  delete the sample owner account
 *   (`DELETE FROM "User" WHERE "email" = 'sample.owner@findmaids.test';`)
 */
import { hashSync } from "bcryptjs";
import { prisma } from "../lib/prisma-script";

const SAMPLE_AGENCY_SLUG = "harbourlight-home-support";
const EMAIL =
  process.env.SAMPLE_AGENCY_EMAIL?.trim() || "sample.owner@findmaids.test";
const PASSWORD =
  process.env.SAMPLE_AGENCY_PASSWORD?.trim() || "Sample-agency-12345";
const OWNER_NAME = "Sample Agency Owner";

const maids = [
  {
    id: "sample-maid-01",
    reference: "S-101",
    nationality: "Filipino",
    age: 29,
    languages: ["English", "Tagalog"],
    placementType: "Full-time placement",
    experienceYears: 4,
    duties: ["Housekeeping", "Meal preparation"],
    monthlySalary: 620,
    status: "AVAILABLE" as const,
    availableFrom: "Mar 2026",
  },
  {
    id: "sample-maid-02",
    reference: "S-102",
    nationality: "Filipino",
    age: 34,
    languages: ["English", "Tagalog", "Mandarin"],
    placementType: "Newborn care",
    experienceYears: 7,
    duties: ["Newborn care", "Housekeeping"],
    monthlySalary: 780,
    status: "ON_HOLD" as const,
    availableFrom: "Apr 2026",
  },
  {
    id: "sample-maid-03",
    reference: "S-103",
    nationality: "Indonesian",
    age: 31,
    languages: ["English", "Bahasa Indonesia"],
    placementType: "Live-in placement",
    experienceYears: 6,
    duties: ["Elder care support", "Meal preparation"],
    monthlySalary: 700,
    status: "PLACED" as const,
    availableFrom: "Placed",
  },
];

const leads = [
  {
    id: "sample-lead-01",
    name: "Sample household (Bukit Timah)",
    email: "sample-lead-1@example.test",
    status: "NEW" as const,
    daysAgo: 2,
    message:
      "Looking for a Filipino helper for newborn care, starting in March, live-in.",
  },
  {
    id: "sample-lead-02",
    name: "Sample household (Tampines)",
    email: "sample-lead-2@example.test",
    status: "CONTACTED" as const,
    daysAgo: 5,
    message: "Needs an Indonesian transfer maid with elder care experience.",
  },
  {
    id: "sample-lead-03",
    name: "Sample household (Jurong)",
    email: "sample-lead-3@example.test",
    status: "CLOSED" as const,
    daysAgo: 16,
    message: "Enquiry filled through another agency.",
  },
];

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000);
}


async function main() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_SAMPLE_SEED !== "true"
  )
    throw new Error(
      "Refusing to seed sample data with NODE_ENV=production. Set ALLOW_SAMPLE_SEED=true only for an isolated demo database.",
    );

  const agency = await prisma.agency.findUnique({
    where: { slug: SAMPLE_AGENCY_SLUG },
    select: { id: true, name: true },
  });
  if (!agency)
    throw new Error(
      `Sample agency "${SAMPLE_AGENCY_SLUG}" was not found. Run supabase/ALL-IN-ONE-sample-setup.sql (or 002 + 003 + 004) first.`,
    );

  // 1. Sample agency owner (AGENCY role, verified so password login works).
  const passwordHash = hashSync(PASSWORD, 10);
  const owner = await prisma.user.upsert({
    where: { email: EMAIL },
    update: {
      name: OWNER_NAME,
      role: "AGENCY",
      passwordHash,
      emailVerified: new Date(),
      disabled: false,
    },
    create: {
      email: EMAIL,
      name: OWNER_NAME,
      role: "AGENCY",
      passwordHash,
      emailVerified: new Date(),
      disabled: false,
      totpEnabled: false,
    },
  });

  // 2. Attach the owner to the sample agency and keep it clearly marked.
  await prisma.agency.update({
    where: { id: agency.id },
    data: { ownerId: owner.id, adminNote: "findmaids:sample-data" },
  });

  // 3. Maid roster for the agency profile and the workspace.
  for (const maid of maids) {
    await prisma.maid.upsert({
      where: { id: maid.id },
      update: { ...maid, agencyId: agency.id, published: true, isSample: true },
      create: {
        ...maid,
        agencyId: agency.id,
        published: true,
        isSample: true,
        createdAt: daysAgo(9),
      },
    });
  }

  // 4. Basic Free plan + active subscription so the billing panel has content.
  const plan = await prisma.plan.upsert({
    where: { name: "Basic Free" },
    update: {},
    create: {
      name: "Basic Free",
      priceMonthly: 0,
      priceYearly: 0,
      features: ["Agency profile", "Up to 3 photos", "10 enquiries per month"],
      listingPriority: 0,
      featuredSlots: 0,
      maxPhotos: 3,
      leadLimit: 10,
    },
  });
  await prisma.subscription.upsert({
    where: { id: "sample-subscription-harbourlight" },
    update: { status: "ACTIVE", planId: plan.id, endDate: null },
    create: {
      id: "sample-subscription-harbourlight",
      agencyId: agency.id,
      planId: plan.id,
      status: "ACTIVE",
      startDate: daysAgo(12),
      endDate: null,
      autoRenew: false,
      billingPeriod: "MONTHLY",
    },
  });


  // 5. Leads so the leads tab and "enquiries this month" tiles are populated.
  for (const lead of leads) {
    const createdAt = daysAgo(lead.daysAgo);
    await prisma.enquiry.upsert({
      where: { id: lead.id },
      update: { status: lead.status, createdAt },
      create: {
        id: lead.id,
        agencyId: agency.id,
        name: lead.name,
        email: lead.email,
        phone: "+65 6000 9000",
        message: lead.message,
        status: lead.status,
        source: "WEB",
        consentGiven: true,
        consentAt: createdAt,
        consentPolicyVersion: "enquiry-consent-v1-draft",
        createdAt,
        ...(lead.status === "CONTACTED"
          ? { firstRespondedAt: new Date(createdAt.getTime() + 3 * 3_600_000) }
          : {}),
      },
    });
  }

  // 6. Analytics events so the 90-day activity chart is not empty.
  let eventCount = 0;
  for (let day = 1; day <= 20; day += 1) {
    const createdAt = daysAgo(day * 4);
    for (const [index, type] of ["profile_view", "placement_click"].entries()) {
      const id = `sample-event-${day}-${index}`;
      eventCount += 1;
      await prisma.analyticsEvent.upsert({
        where: { id },
        update: {},
        create: { id, agencyId: agency.id, type, createdAt },
      });
    }
  }

  console.info(`Sample workspace ready for ${agency.name}`);
  console.info("  Sign in    /login");
  console.info(`  Email      ${EMAIL}`);
  console.info(`  Password   ${PASSWORD}`);
  console.info("  Dashboard  /agency/dashboard");
  console.info(
    `  Seeded     ${maids.length} maids, ${leads.length} leads, ${eventCount} analytics events, 1 plan subscription`,
  );
  console.info(
    `  Clean up   supabase/009-remove-sample-data.sql and delete the "${EMAIL}" user`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Sample seeding failed.",
    );
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
