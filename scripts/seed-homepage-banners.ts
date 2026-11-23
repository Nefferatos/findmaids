/**
 * Seeds a few clearly marked demo agencies with banner images so the homepage
 * "Licensed agencies" grid can be reviewed locally or on staging.
 *
 * Run: npm run seed:homepage-banners
 *
 * Safe to re-run: agencies are upserted by slug and the paid records are only
 * created when missing. The agencies are marked with the shared sample marker
 * (`Agency.adminNote = "findmaids:sample-data"`), so the live deployment hides
 * them while `npm run dev` still shows them, and
 * `supabase/009-remove-sample-data.sql` deletes them for good.
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

const demoAgencies = [
  {
    slug: "demo-casa-care",
    name: "Casa Care (Demo)",
    bannerUrl: "/banners/agency-banner-1.svg",
    logoUrl: "/banners/logo-1.svg",
    photoUrl: "/banners/cover-1.svg",
    phone: "+65 6123 4567",
    email: "demo.casa@example.test",
    featured: true,
  },
  {
    slug: "demo-bright-home",
    name: "Bright Home (Demo)",
    bannerUrl: "/banners/agency-banner-2.svg",
    logoUrl: "/banners/logo-2.svg",
    photoUrl: "/banners/cover-2.svg",
    phone: "+65 6234 5678",
    email: "demo.bright@example.test",
    featured: true,
  },
  {
    slug: "demo-nanyang-helpers",
    name: "Nanyang Helpers (Demo)",
    bannerUrl: "/banners/agency-banner-3.svg",
    logoUrl: "/banners/logo-3.svg",
    photoUrl: "/banners/cover-3.svg",
    phone: "+65 6345 6789",
    email: "demo.nanyang@example.test",
    featured: false,
  },
];

async function main() {
  const now = new Date();
  const startDate = new Date(now.getTime() - 30 * 86_400_000);
  const endDate = new Date(now.getTime() + 365 * 86_400_000);

  const plan = await prisma.plan.upsert({
    where: { name: "Homepage Banner Demo" },
    update: { isActive: true },
    create: {
      name: "Homepage Banner Demo",
      priceMonthly: 0,
      priceYearly: 0,
      features: ["Demo plan used only to preview homepage agency banners"],
      listingPriority: 5,
      featuredSlots: 1,
      maxPhotos: 10,
      isActive: true,
    },
  });

  for (const [index, entry] of demoAgencies.entries()) {
    const agency = await prisma.agency.upsert({
      where: { slug: entry.slug },
      update: {
        name: entry.name,
        bannerUrl: entry.bannerUrl,
        logoUrl: entry.logoUrl,
        status: AgencyStatus.APPROVED,
        verifiedBadge: true,
        adminNote: DEMO_NOTE,
      },
      create: {
        name: entry.name,
        slug: entry.slug,
        description: `${entry.name} is a demo agency profile used to preview the FindMaids homepage banner grid. It is not a real agency; contact details are placeholders.`,
        address: "1 Demo Road",
        city: "Singapore",
        province: "Singapore",
        phone: entry.phone,
        whatsapp: entry.phone,
        email: entry.email,
        services: ["Full-time placement", "Part-time placement"],
        serviceLocations: ["Singapore"],
        nationalitiesServed: ["Filipino", "Indonesian", "Myanmar", "Indian"],
        languages: ["English", "Mandarin", "Malay"],
        status: AgencyStatus.APPROVED,
        verifiedBadge: true,
        adminNote: DEMO_NOTE,
        bannerUrl: entry.bannerUrl,
        logoUrl: entry.logoUrl,
      },
    });

    // Sample cover photo: used as the card background and in the profile gallery.
    const existingPhoto = await prisma.agencyPhoto.findFirst({
      where: { agencyId: agency.id, url: entry.photoUrl },
    });
    if (!existingPhoto) {
      await prisma.agencyPhoto.create({
        data: {
          agencyId: agency.id,
          url: entry.photoUrl,
          caption: `${entry.name} office`,
          sortOrder: 0,
        },
      });
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
      // checked-in Prisma schema does not declare, so a normal `payment.create`
      // is rejected by Postgres. The demo invoice is inserted directly instead;
      // it is still a regular Payment row that the app reads normally.
      const paymentId = `demo-payment-${agency.id}`;
      await prisma.$executeRaw`
        insert into "Payment" (
          "id", "subscriptionId", "amount", "currency", "status", "provider",
          "invoiceNumber", "paidAt", "createdAt", "updatedAt", "billingPeriod",
          "prorated"
        ) values (
          ${paymentId}, ${subscription.id}, 0, 'SGD', 'PAID', 'seed-demo',
          ${`DEMO-BANNER-${Date.now()}-${index + 1}`}, ${now}, ${now}, ${now},
          'MONTHLY', false
        )
      `;
    }

    // Featured placements sort first on the homepage.
    if (entry.featured) {
      const placement = await prisma.adPlacement.findFirst({
        where: {
          agencyId: agency.id,
          type: AdPlacementType.HOMEPAGE,
          status: AdPlacementStatus.ACTIVE,
        },
      });
      if (!placement) {
        await prisma.adPlacement.create({
          data: {
            agencyId: agency.id,
            type: AdPlacementType.HOMEPAGE,
            status: AdPlacementStatus.ACTIVE,
            startDate,
            endDate,
          },
        });
      }
    }

    console.log(
      `Seeded ${agency.name} (${agency.slug}) with ${entry.bannerUrl}`,
    );
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
