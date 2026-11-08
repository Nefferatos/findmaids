import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";

/**
 * CRUD coverage for the data layer the app actually uses.
 *
 * With no DATABASE_URL in the Vitest environment, `lib/prisma.ts` resolves to the
 * in-memory client (`lib/prisma-mock.ts`), so this suite runs anywhere. Point it
 * at a real database with:
 *
 *   $env:DATABASE_URL="postgresql://..."; $env:PRISMA_MOCK="false"; npx vitest run tests/crud.test.ts
 *
 * (the mock-only block at the bottom is skipped in that mode).
 */
process.env.PRISMA_MOCK = "true";
delete process.env.PRISMA_MOCK_FILE;

let prisma: PrismaClient;
let directory: typeof import("@/lib/directory");
let maids: typeof import("@/lib/maids");

const agencyBase = {
  description: "CRUD test agency profile.",
  address: "1 Test Road",
  city: "Singapore",
  province: "Central Region",
  phone: "+65 6000 0000",
  email: "crud@example.test",
  services: ["Full-time placement"],
  serviceLocations: ["Singapore"],
  nationalitiesServed: ["Filipino", "Indonesian"],
  languages: ["English", "Tagalog"],
  // Written explicitly so the suite behaves the same against Postgres and the
  // in-memory client (which only applies a small set of column defaults).
  status: "APPROVED" as const,
  verifiedBadge: false,
  profileCompleteness: 0,
  onboardingStep: 1,
  foundingAgency: false,
};

async function createAgency(overrides: Record<string, unknown> = {}) {
  return prisma.agency.create({
    data: {
      ...agencyBase,
      id: `crud-agency-${Math.random().toString(36).slice(2, 8)}`,
      name: "CRUD Test Agency",
      slug: `crud-test-agency-${Math.random().toString(36).slice(2, 8)}`,
      ...overrides,
    } as Parameters<typeof prisma.agency.create>[0]["data"],
  });
}

async function createMaid(agencyId: string, overrides: Record<string, unknown> = {}) {
  return prisma.maid.create({
    data: {
      agencyId,
      reference: `M-${Math.random().toString(36).slice(2, 7)}`,
      nationality: "Filipino",
      age: 29,
      languages: ["English", "Tagalog"],
      placementType: "Full-time placement",
      experienceYears: 4,
      duties: ["Housekeeping"],
      monthlySalary: 620,
      status: "AVAILABLE" as const,
      published: true,
      isSample: false,
      ...overrides,
    } as Parameters<typeof prisma.maid.create>[0]["data"],
  });
}

beforeAll(async () => {
  ({ prisma } = await import("@/lib/prisma"));
  directory = await import("@/lib/directory");
  maids = await import("@/lib/maids");
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.maid.deleteMany({});
  await prisma.agency.deleteMany({});
  await prisma.plan.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.enquiry.deleteMany({});
  await prisma.review.deleteMany({});
  await prisma.user.deleteMany({});
});

describe("user CRUD", () => {
  it("creates, reads, updates and deletes an employer account", async () => {
    const created = await prisma.user.create({
      data: { email: "crud-employer@example.test", name: "CRUD Employer" },
    });
    expect(created.id).toBeTruthy();
    expect(created.role).toBe("VISITOR");

    const found = await prisma.user.findUnique({
      where: { email: "crud-employer@example.test" },
    });
    expect(found?.name).toBe("CRUD Employer");

    const updated = await prisma.user.update({
      where: { id: created.id },
      data: { name: "Renamed Employer", emailVerified: new Date() },
    });
    expect(updated.name).toBe("Renamed Employer");
    expect(updated.emailVerified).toBeInstanceOf(Date);

    await prisma.user.delete({ where: { id: created.id } });
    expect(await prisma.user.findUnique({ where: { id: created.id } })).toBeNull();
    expect(await prisma.user.count()).toBe(0);
  });
});

describe("agency CRUD", () => {
  it("creates an approved agency and reads it back by slug", async () => {
    const created = await createAgency({ slug: "crud-agency-alpha" });
    const found = await prisma.agency.findFirst({
      where: { slug: "crud-agency-alpha", status: "APPROVED" },
    });
    expect(found?.id).toBe(created.id);
    expect(found?.nationalitiesServed).toEqual(["Filipino", "Indonesian"]);
    expect(found?.verifiedBadge).toBe(false);
  });

  it("updates profile fields and flips approval state", async () => {
    const created = await createAgency({ slug: "crud-agency-beta" });
    const updated = await prisma.agency.update({
      where: { id: created.id },
      data: {
        verifiedBadge: true,
        profileCompleteness: 90,
        nationalitiesServed: ["Filipino", "Myanmar"],
      },
    });
    expect(updated.verifiedBadge).toBe(true);
    expect(updated.profileCompleteness).toBe(90);
    expect(updated.nationalitiesServed).toEqual(["Filipino", "Myanmar"]);

    const pending = await prisma.agency.update({
      where: { id: created.id },
      data: { status: "PENDING" },
    });
    expect(pending.status).toBe("PENDING");
    expect(
      await prisma.agency.findFirst({
        where: { slug: "crud-agency-beta", status: "APPROVED" },
      }),
    ).toBeNull();
  });

  it("deletes an agency and counts the remaining rows", async () => {
    const first = await createAgency({ slug: "crud-agency-gamma" });
    await createAgency({ slug: "crud-agency-delta" });
    expect(await prisma.agency.count()).toBe(2);

    await prisma.agency.delete({ where: { id: first.id } });
    expect(await prisma.agency.count()).toBe(1);
    const remaining = await prisma.agency.findMany({});
    expect(remaining.map((agency) => agency.slug)).toEqual(["crud-agency-delta"]);
  });
});

describe("maid CRUD", () => {
  it("creates a maid profile with its arrays, enum and salary", async () => {
    const agency = await createAgency();
    const maid = await createMaid(agency.id, { reference: "S-001" });

    expect(maid.id).toBeTruthy();
    expect(maid.reference).toBe("S-001");
    expect(maid.status).toBe("AVAILABLE");
    expect(maid.languages).toEqual(["English", "Tagalog"]);
    expect(maid.monthlySalary).toBe(620);
    expect(maid.isSample).toBe(false);
  });

  it("reads a roster by agency and publication state", async () => {
    const agency = await createAgency();
    const other = await createAgency();
    await createMaid(agency.id, { reference: "S-002", status: "ON_HOLD" });
    await createMaid(agency.id, { reference: "S-003", status: "PLACED" });
    await createMaid(agency.id, { reference: "S-004", published: false });
    await createMaid(other.id, { reference: "S-005" });

    const published = await prisma.maid.findMany({
      where: { agencyId: agency.id, published: true },
    });
    expect(published.map((row) => row.reference).sort()).toEqual([
      "S-002",
      "S-003",
    ]);

    const placed = await prisma.maid.findMany({
      where: { agencyId: agency.id, status: "PLACED" },
    });
    expect(placed).toHaveLength(1);
    expect(await prisma.maid.count({ where: { agencyId: agency.id } })).toBe(3);
  });

  it("updates status, salary and availability, then deletes the profile", async () => {
    const agency = await createAgency();
    const maid = await createMaid(agency.id, { reference: "S-006" });

    const updated = await prisma.maid.update({
      where: { id: maid.id },
      data: {
        status: "PLACED",
        monthlySalary: 750,
        availableFrom: "Placed",
        notes: "Placed with a family in Tampines.",
      },
    });
    expect(updated.status).toBe("PLACED");
    expect(updated.monthlySalary).toBe(750);
    expect(updated.availableFrom).toBe("Placed");

    await prisma.maid.delete({ where: { id: maid.id } });
    expect(await prisma.maid.findUnique({ where: { id: maid.id } })).toBeNull();
  });

  it("keeps the sample rows separable so the cleanup script can remove them", async () => {
    const agency = await createAgency();
    await createMaid(agency.id, { reference: "REAL-1", isSample: false });
    await createMaid(agency.id, { reference: "SAMPLE-1", isSample: true });

    expect(await prisma.maid.count({ where: { isSample: true } })).toBe(1);
    // What supabase/009-remove-sample-data.sql does:
    const removed = await prisma.maid.deleteMany({ where: { isSample: true } });
    expect(removed.count).toBe(1);
    const left = await prisma.maid.findMany({});
    expect(left.map((row) => row.reference)).toEqual(["REAL-1"]);
  });
});

describe("plan and subscription CRUD", () => {
  it("creates a plan, links a subscription, updates and removes both", async () => {
    const agency = await createAgency();
    const plan = await prisma.plan.create({
      data: {
        name: "CRUD Gold",
        priceMonthly: 999,
        priceYearly: 9990,
        features: ["Enhanced profile"],
        listingPriority: 10,
        featuredSlots: 1,
        maxPhotos: 10,
        leadLimit: 100,
      },
    });
    expect(plan.name).toBe("CRUD Gold");

    const subscription = await prisma.subscription.create({
      data: {
        agencyId: agency.id,
        planId: plan.id,
        status: "ACTIVE",
        startDate: new Date("2026-01-01T00:00:00Z"),
        billingPeriod: "MONTHLY",
      },
    });
    expect(subscription.agencyId).toBe(agency.id);
    expect(subscription.planId).toBe(plan.id);

    const cancelled = await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: "CANCELLED", cancelAtPeriodEnd: true },
    });
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelAtPeriodEnd).toBe(true);

    const found = await prisma.subscription.findFirst({
      where: { agencyId: agency.id, status: "CANCELLED" },
    });
    expect(found?.id).toBe(subscription.id);

    await prisma.subscription.delete({ where: { id: subscription.id } });
    await prisma.plan.delete({ where: { id: plan.id } });
    expect(await prisma.subscription.count()).toBe(0);
    expect(await prisma.plan.count()).toBe(0);
  });
});

describe("enquiry CRUD (employer leads)", () => {
  it("creates, counts this month, updates status and deletes a lead", async () => {
    const agency = await createAgency();
    const created = await prisma.enquiry.create({
      data: {
        agencyId: agency.id,
        name: "CRUD Household",
        email: "crud-lead@example.test",
        message: "Looking for a Filipino helper for newborn care.",
        consentGiven: true,
        source: "WEB",
        // Explicit so the suite behaves the same with and without column defaults.
        status: "NEW",
      },
    });
    expect(created.status).toBe("NEW");

    const monthStart = new Date(Date.UTC(2000, 0, 1));
    expect(
      await prisma.enquiry.count({
        where: { agencyId: agency.id, createdAt: { gte: monthStart } },
      }),
    ).toBe(1);

    const replied = await prisma.enquiry.update({
      where: { id: created.id },
      data: { status: "CONTACTED", firstRespondedAt: new Date() },
    });
    expect(replied.status).toBe("CONTACTED");
    expect(replied.firstRespondedAt).toBeInstanceOf(Date);

    const closed = await prisma.enquiry.updateMany({
      where: { agencyId: agency.id, status: "CONTACTED" },
      data: { status: "CLOSED" },
    });
    expect(closed.count).toBe(1);

    await prisma.enquiry.delete({ where: { id: created.id } });
    expect(await prisma.enquiry.count()).toBe(0);
  });
});

describe("review CRUD (moderation)", () => {
  it("creates a pending review, publishes it and removes it", async () => {
    const agency = await createAgency();
    const review = await prisma.review.create({
      data: {
        agencyId: agency.id,
        authorName: "CRUD Reviewer",
        rating: 5,
        title: "CRUD review",
        body: "A review written by the automated CRUD test.",
        status: "PENDING",
      },
    });
    expect(review.status).toBe("PENDING");
    expect(
      await prisma.review.count({
        where: { agencyId: agency.id, status: "PUBLISHED" },
      }),
    ).toBe(0);

    const published = await prisma.review.update({
      where: { id: review.id },
      data: { status: "PUBLISHED", agencyReply: "Thank you." },
    });
    expect(published.status).toBe("PUBLISHED");
    expect(published.agencyReply).toBe("Thank you.");

    const visible = await prisma.review.findMany({
      where: { agencyId: agency.id, status: "PUBLISHED" },
    });
    expect(visible).toHaveLength(1);
    expect(visible[0].rating).toBe(5);

    await prisma.review.delete({ where: { id: review.id } });
    expect(await prisma.review.count()).toBe(0);
  });
});

describe("directory read path", () => {
  it("hides sample agencies and maids on a live deployment", async () => {
    const real = await createAgency({ name: "Real Agency", slug: "crud-real" });
    const sample = await createAgency({
      name: "Sample Agency",
      slug: "crud-sample",
      adminNote: "findmaids:sample-data",
    });
    await createMaid(real.id, { reference: "REAL-1" });

    // Development: both agencies are visible, sample maids included.
    expect(
      directory.buildAgencyWhere(directory.parseDirectoryFilters({})).AND,
    ).toBeUndefined();
    expect(maids.publishedMaidWhere()).toEqual({ published: true });

    const previousAppEnv = process.env.APP_ENV;
    process.env.APP_ENV = "production";
    try {
      const where = directory.buildAgencyWhere(
        directory.parseDirectoryFilters({}),
      );
      expect(where.status).toBe("APPROVED");
      expect(Array.isArray(where.AND)).toBe(true);
      expect(where.AND).toHaveLength(1);

      const visible = await prisma.agency.findMany({ where });
      expect(visible.map((agency) => agency.slug)).toEqual(["crud-real"]);
      expect(visible.some((agency) => agency.id === sample.id)).toBe(false);

      // Maid reads exclude flagged sample rows as well.
      expect(maids.publishedMaidWhere()).toEqual({
        published: true,
        AND: [{ isSample: false }],
      });
      expect(maids.publishedMaidWhere(real.id)).toEqual({
        published: true,
        agencyId: real.id,
        AND: [{ isSample: false }],
      });
      expect(
        await prisma.maid.count({ where: maids.publishedMaidWhere(real.id) }),
      ).toBe(1);
    } finally {
      if (previousAppEnv === undefined) delete process.env.APP_ENV;
      else process.env.APP_ENV = previousAppEnv;
    }
  });
});


