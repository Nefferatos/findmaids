/**
 * Seeds clearly fake sample maid agencies so the /maid-agency directory and the
 * homepage "Licensed agencies" grid can be reviewed with real layout data.
 *
 * Run: npm run seed:agency-directory
 *
 * Everything created here is marked as sample data:
 *   - agencies: adminNote = "findmaids:sample-data"
 *   - maids:    isSample = true
 * so `supabase/009-remove-sample-data.sql` (or deleting by those markers)
 * removes it again, and live deployments never render it.
 *
 * Safe to re-run: agencies are upserted by slug, maids by (agencyId, reference)
 * and paid records are only created when missing.
 */
import {
  AdPlacementStatus,
  AdPlacementType,
  AgencyStatus,
  BillingPeriod,
  PaymentStatus,
  SubscriptionStatus,
} from "@/lib/generated/prisma/client";
import { SAMPLE_AGENCY_MARKER } from "../lib/sample-data";
import { prisma } from "../lib/prisma-script";

const DEMO_NOTE = SAMPLE_AGENCY_MARKER;
const BANNERS = "/banners/directory";

type SampleAgency = {
  slug: string;
  name: string;
  address: string;
  postalCode: string;
  area: string;
  region: string;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  contactPerson: string;
  logo: number;
  banner: number | null;
  left: number | null;
  right: number | null;
  paid: boolean;
  featured: boolean;
  maids: { nationality: string; count: number }[];
};

const agencies: SampleAgency[] = [
  {
    slug: "sample-agency-one",
    name: "Sample Agency One (Demo)",
    address: "Blk 213 Ang Mo Kio Avenue 3 #01-02, Singapore 560213",
    postalCode: "560213",
    area: "Ang Mo Kio",
    region: "North-East Region",
    latitude: 1.3691,
    longitude: 103.8454,
    phone: "+65 6000 0001",
    contactPerson: "Demo Contact One",
    logo: 1,
    banner: 1,
    left: 1,
    right: 1,
    paid: true,
    featured: true,
    maids: [
      { nationality: "Filipino", count: 4 },
      { nationality: "Indonesian", count: 2 },
    ],
  },
  {
    slug: "sample-agency-two",
    name: "Sample Agency Two (Demo)",
    address: "Blk 150 Bishan Street 11 #02-10, Singapore 570150",
    postalCode: "570150",
    area: "Bishan",
    region: "Central Region",
    latitude: 1.3508,
    longitude: 103.8485,
    phone: "+65 6000 0002",
    contactPerson: "Demo Contact Two",
    logo: 2,
    banner: 2,
    left: 2,
    right: 2,
    paid: true,
    featured: true,
    maids: [
      { nationality: "Myanmar", count: 3 },
      { nationality: "Indian", count: 1 },
    ],
  },
  {
    slug: "sample-agency-three",
    name: "Sample Agency Three (Demo)",
    address: "181 Orchard Road #08-12, Singapore 238896",
    postalCode: "238896",
    area: "Orchard",
    region: "Central Region",
    latitude: 1.3048,
    longitude: 103.8318,
    phone: "+65 6000 0003",
    contactPerson: "Demo Contact Three",
    logo: 3,
    banner: 3,
    left: 3,
    right: 3,
    paid: true,
    featured: true,
    maids: [{ nationality: "Filipino", count: 5 }],
  },
  {
    slug: "sample-agency-four",
    name: "Sample Agency Four (Demo)",
    address: "112 East Coast Road #03-05, Singapore 428802",
    postalCode: "428802",
    area: "Katong",
    region: "East Region",
    latitude: 1.3048,
    longitude: 103.904,
    phone: "+65 6000 0004",
    contactPerson: "Demo Contact Four",
    logo: 4,
    banner: 4,
    left: 4,
    right: 4,
    paid: true,
    featured: true,
    maids: [
      { nationality: "Indonesian", count: 4 },
      { nationality: "Filipino", count: 2 },
    ],
  },
  {
    slug: "sample-agency-five",
    name: "Sample Agency Five (Demo)",
    address: "Blk 923 Yishun Central 1 #01-08, Singapore 760923",
    postalCode: "760923",
    area: "Yishun",
    region: "North Region",
    latitude: 1.4304,
    longitude: 103.8354,
    phone: "+65 6000 0005",
    contactPerson: "Demo Contact Five",
    logo: 5,
    banner: 5,
    left: 5,
    right: 3,
    paid: true,
    featured: false,
    maids: [
      { nationality: "Myanmar", count: 2 },
      { nationality: "Indian", count: 3 },
    ],
  },
  {
    slug: "sample-agency-six",
    name: "Sample Agency Six (Demo)",
    address: "170 Upper Bukit Timah Road #04-01, Singapore 588179",
    postalCode: "588179",
    area: "Bukit Timah",
    region: "Central Region",
    latitude: 1.3294,
    longitude: 103.8021,
    phone: "+65 6000 0006",
    contactPerson: "Demo Contact Six",
    logo: 6,
    banner: 6,
    left: 2,
    right: 4,
    paid: true,
    featured: false,
    maids: [
      { nationality: "Filipino", count: 3 },
      { nationality: "Myanmar", count: 2 },
    ],
  },

  {
    slug: "sample-agency-seven",
    name: "Sample Agency Seven (Demo)",
    address: "Blk 510 Tampines Central 1 #02-03, Singapore 520510",
    postalCode: "520510",
    area: "Tampines",
    region: "East Region",
    latitude: 1.3496,
    longitude: 103.9568,
    phone: "+65 6000 0007",
    contactPerson: "Demo Contact Seven",
    logo: 1,
    banner: null,
    left: null,
    right: null,
    paid: false,
    featured: false,
    maids: [{ nationality: "Indonesian", count: 3 }],
  },
  {
    slug: "sample-agency-eight",
    name: "Sample Agency Eight (Demo)",
    address: "Blk 888 Woodlands Drive 50 #01-15, Singapore 730888",
    postalCode: "730888",
    area: "Woodlands",
    region: "North Region",
    latitude: 1.4382,
    longitude: 103.789,
    phone: "+65 6000 0008",
    contactPerson: "Demo Contact Eight",
    logo: 2,
    banner: null,
    left: null,
    right: null,
    paid: false,
    featured: false,
    maids: [
      { nationality: "Indian", count: 2 },
      { nationality: "Myanmar", count: 1 },
    ],
  },
  {
    slug: "sample-agency-nine",
    name: "Sample Agency Nine (Demo)",
    address: "Blk 253 Serangoon Central Drive #03-02, Singapore 550253",
    postalCode: "550253",
    area: "Serangoon",
    region: "North-East Region",
    latitude: 1.3554,
    longitude: 103.872,
    phone: "+65 6000 0009",
    contactPerson: "Demo Contact Nine",
    logo: 3,
    banner: null,
    left: null,
    right: null,
    paid: false,
    featured: false,
    maids: [{ nationality: "Filipino", count: 4 }],
  },
  {
    slug: "sample-agency-ten",
    name: "Sample Agency Ten (Demo)",
    address: "Blk 130 Jurong East Street 13 #01-01, Singapore 600130",
    postalCode: "600130",
    area: "Jurong East",
    region: "West Region",
    // Deliberately without coordinates: the directory sorts this one last when
    // an area is selected.
    latitude: null,
    longitude: null,
    phone: "+65 6000 0010",
    contactPerson: "Demo Contact Ten",
    logo: 4,
    banner: null,
    left: null,
    right: null,
    paid: false,
    featured: false,
    maids: [],
  },
];

function bannerPath(
  kind: "horizontal" | "left" | "right" | "logo",
  index: number,
) {
  return `${BANNERS}/${kind}-${index}.svg`;
}

async function main() {
  const now = new Date();
  const startDate = new Date(now.getTime() - 30 * 86_400_000);
  const endDate = new Date(now.getTime() + 365 * 86_400_000);

  const plan = await prisma.plan.upsert({
    where: { name: "Agency Directory Demo" },
    update: { isActive: true },
    create: {
      name: "Agency Directory Demo",
      priceMonthly: 0,
      priceYearly: 0,
      features: ["Demo plan used only to preview the maid agency directory"],
      listingPriority: 5,
      featuredSlots: 1,
      maxPhotos: 10,
      isActive: true,
    },
  });

  for (const [index, entry] of agencies.entries()) {
    const bannerUrl = entry.banner
      ? bannerPath("horizontal", entry.banner)
      : null;
    const fields = {
      name: entry.name,
      description: `${entry.name} is a demonstration agency profile used to preview the FindMaids maid agency directory. It is not a real agency and every contact detail on this profile is a placeholder.`,
      address: entry.address,
      city: entry.area,
      province: entry.region,
      postalCode: entry.postalCode,
      contactPerson: entry.contactPerson,
      latitude: entry.latitude,
      longitude: entry.longitude,
      phone: entry.phone,
      whatsapp: entry.phone,
      email: `sample-agency-${index + 1}@example.test`,
      services: ["Full-time placement", "Transfer placement"],
      serviceLocations: [entry.area],
      nationalitiesServed: entry.maids.map((maid) => maid.nationality),
      languages: ["English", "Mandarin"],
      status: AgencyStatus.APPROVED,
      verifiedBadge: false,
      adminNote: DEMO_NOTE,
      logoUrl: bannerPath("logo", entry.logo),
      bannerUrl,
      bannerLeftUrl: entry.left ? bannerPath("left", entry.left) : null,
      bannerRightUrl: entry.right ? bannerPath("right", entry.right) : null,
      licenseNumber: `SAMPLE-${String(index + 1).padStart(4, "0")}`,
    };

    const agency = await prisma.agency.upsert({
      where: { slug: entry.slug },
      update: fields,
      create: { ...fields, slug: entry.slug },
    });

    for (const [maidIndex, group] of entry.maids.entries()) {
      for (let count = 0; count < group.count; count += 1) {
        const reference = `SAMPLE-${index + 1}-${maidIndex + 1}-${count + 1}`;
        await prisma.maid.upsert({
          where: {
            agencyId_reference: { agencyId: agency.id, reference },
          },
          update: {
            nationality: group.nationality,
            status: "AVAILABLE",
            published: true,
            isSample: true,
            agencyContact: { contactPerson: entry.contactPerson },
          },
          create: {
            agencyId: agency.id,
            reference,
            nationality: group.nationality,
            age: 26 + ((index + count) % 12),
            languages: ["English"],
            placementType: index % 2 === 0 ? "New" : "Transfer",
            duties: ["General housework", "Cooking"],
            monthlySalary: 600 + index * 20,
            status: "AVAILABLE",
            published: true,
            isSample: true,
            agencyContact: { contactPerson: entry.contactPerson },
          },
        });
      }
    }

    if (!entry.paid) {
      console.log(`Seeded ${agency.name} (${agency.slug}) without a paid plan`);
      continue;
    }

    let subscription = await prisma.subscription.findFirst({
      where: {
        agencyId: agency.id,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
      },
    });
    if (!subscription) {
      subscription = await prisma.subscription.create({
        data: {
          agencyId: agency.id,
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          startDate,
          endDate,
          autoRenew: false,
          billingPeriod: BillingPeriod.MONTHLY,
        },
      });
    }

    const paid = await prisma.payment.findFirst({
      where: {
        subscriptionId: subscription.id,
        status: PaymentStatus.PAID,
      },
    });
    if (!paid) {
      // The deployed database stores a required `provider` column that the
      // checked-in Prisma schema does not declare, so the demo invoice is
      // inserted directly (same approach as scripts/seed-homepage-banners.ts).
      const paymentId = `sample-payment-${agency.id}`;
      await prisma.$executeRaw`
        insert into "Payment" (
          "id", "subscriptionId", "amount", "currency", "status", "provider",
          "invoiceNumber", "paidAt", "createdAt", "updatedAt", "billingPeriod",
          "prorated"
        ) values (
          ${paymentId}, ${subscription.id}, 0, 'SGD', 'PAID', 'seed-demo',
          ${`SAMPLE-DIRECTORY-${Date.now()}-${index + 1}`}, ${now}, ${now}, ${now},
          'MONTHLY', false
        )
      `;
    }

    if (entry.featured) {
      const placement = await prisma.adPlacement.findFirst({
        where: {
          agencyId: agency.id,
          type: AdPlacementType.FEATURED,
          status: AdPlacementStatus.ACTIVE,
        },
      });
      if (!placement) {
        await prisma.adPlacement.create({
          data: {
            agencyId: agency.id,
            type: AdPlacementType.FEATURED,
            status: AdPlacementStatus.ACTIVE,
            startDate,
            endDate,
          },
        });
      }
    }

    console.log(`Seeded ${agency.name} (${agency.slug}) with a paid demo plan`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
