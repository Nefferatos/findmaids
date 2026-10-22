import {
  AgencyStatus,
  EnquirySource,
  EnquiryStatus,
  FeatureFlagScope,
  PrismaClient,
  ReviewStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

const plans = [
  {
    name: "Basic Free",
    priceMonthly: 0,
    priceYearly: 0,
    listingPriority: 0,
    featuredSlots: 0,
    maxPhotos: 3,
    leadLimit: 10,
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
    features: [
      "Premium profile",
      "Up to 25 photos",
      "Homepage banner",
      "Featured card",
      "Category top placement",
    ],
  },
];

const agencies = [
  [
    "Harborlight Home Partners",
    "harborlight-home-partners",
    "Makati",
    "Metro Manila",
  ],
  [
    "Bayanihan Care Network",
    "bayanihan-care-network",
    "Quezon City",
    "Metro Manila",
  ],
  [
    "Greenfield Household Services",
    "greenfield-household-services",
    "Pasig",
    "Metro Manila",
  ],
  [
    "Northstar Domestic Staffing",
    "northstar-domestic-staffing",
    "Manila",
    "Metro Manila",
  ],
  ["Cebu Kindred Home Agency", "cebu-kindred-home-agency", "Cebu City", "Cebu"],
  [
    "Island Welcome Household Care",
    "island-welcome-household-care",
    "Mandaue",
    "Cebu",
  ],
  [
    "Sugbo Family Support Services",
    "sugbo-family-support-services",
    "Lapu-Lapu",
    "Cebu",
  ],
  [
    "Davao Hearthside Placement",
    "davao-hearthside-placement",
    "Davao City",
    "Davao del Sur",
  ],
  [
    "Durian City Care Partners",
    "durian-city-care-partners",
    "Davao City",
    "Davao del Sur",
  ],
  [
    "Southern Cross Home Staffing",
    "southern-cross-home-staffing",
    "Tagum",
    "Davao del Norte",
  ],
] as const;

async function main() {
  const planRecords = await Promise.all(
    plans.map((plan) =>
      prisma.plan.upsert({
        where: { name: plan.name },
        update: plan,
        create: plan,
      }),
    ),
  );

  const agencyRecords = await Promise.all(
    agencies.map(([name, slug, city, province], index) =>
      prisma.agency.upsert({
        where: { slug },
        update: {},
        create: {
          name,
          slug,
          description: `${name} is a sample household staffing agency profile for local development.`,
          address: `${100 + index} Sample Street`,
          city,
          province,
          phone: `+63 917 555 ${String(1000 + index).slice(-4)}`,
          whatsapp: `+63 917 555 ${String(1000 + index).slice(-4)}`,
          email: `contact${index + 1}@example.test`,
          services: ["Full-time placement", "Part-time placement"],
          nationalitiesServed: ["Filipino"],
          languages: ["English", "Filipino"],
          status: AgencyStatus.APPROVED,
          verifiedBadge: index < 3,
        },
      }),
    ),
  );

  await Promise.all(
    agencyRecords.slice(0, 3).map((agency, index) =>
      prisma.review.upsert({
        where: { id: `seed-review-${index + 1}` },
        update: {},
        create: {
          id: `seed-review-${index + 1}`,
          agencyId: agency.id,
          authorName: ["M. Santos", "J. Reyes", "A. Cruz"][index],
          rating: 4 + (index % 2),
          title: "Sample review",
          body: "A sample review for local development only.",
          status: ReviewStatus.PUBLISHED,
        },
      }),
    ),
  );

  await Promise.all(
    agencyRecords.slice(0, 3).map((agency, index) =>
      prisma.enquiry.upsert({
        where: { id: `seed-enquiry-${index + 1}` },
        update: {},
        create: {
          id: `seed-enquiry-${index + 1}`,
          agencyId: agency.id,
          name: [
            "Sample Visitor One",
            "Sample Visitor Two",
            "Sample Visitor Three",
          ][index],
          email: `visitor${index + 1}@example.test`,
          phone: "+63 900 000 0000",
          message: "This is sample enquiry data for local development.",
          status: EnquiryStatus.NEW,
          consentGiven: true,
          source: EnquirySource.WEB,
        },
      }),
    ),
  );

  const featureKeys = [
    "employer_assistant",
    "agency_auto_reply",
    "agency_profile_helper",
    "agency_knowledge_base",
  ];
  await Promise.all(
    featureKeys.map(async (key) => {
      const existing = await prisma.featureFlag.findFirst({
        where: { key, scope: FeatureFlagScope.GLOBAL, agencyId: null },
      });
      if (existing) {
        await prisma.featureFlag.update({
          where: { id: existing.id },
          data: { enabled: false },
        });
      } else {
        await prisma.featureFlag.create({
          data: { key, scope: FeatureFlagScope.GLOBAL, enabled: false },
        });
      }
    }),
  );

  console.info(
    `Seeded ${planRecords.length} plans, ${agencyRecords.length} agencies, and disabled AI flags.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
