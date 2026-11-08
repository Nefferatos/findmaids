import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

/**
 * CRUD through the HTTP route handlers (the paths the app actually calls).
 * Runs against the in-memory Prisma client because no database is configured;
 * e-mail, Redis and Turnstile are disabled so nothing leaves the process.
 */

// The routes read request cookies through `next/headers`, which only resolves
// inside a Next.js request scope. Provide an empty jar for the unit context.
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    getAll: () => [],
    has: () => false,
  }),
  headers: async () => new Headers(),
}));

process.env.PRISMA_MOCK = "true";
delete process.env.PRISMA_MOCK_FILE;
process.env.EMAIL_DELIVERY_DISABLED = "true";
process.env.AI_PROVIDER = "mock";
delete process.env.REDIS_URL;
delete process.env.TURNSTILE_SECRET_KEY;
delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

let prisma: PrismaClient;

function post(body: unknown, ip = "203.0.113.10") {
  return new Request("http://localhost/api", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
      "cf-connecting-ip": ip,
    },
    body: JSON.stringify(body),
  });
}

async function createAgency(slug = "api-crud-agency", name = "API CRUD Agency") {
  return prisma.agency.create({
    data: {
      name,
      slug,
      description: "Agency used by the API CRUD tests.",
      address: "1 API Road",
      city: "Singapore",
      province: "Central Region",
      phone: "+65 6000 1111",
      email: `${slug}@example.test`,
      services: ["Full-time placement"],
      serviceLocations: ["Singapore"],
      nationalitiesServed: ["Filipino"],
      languages: ["English"],
      status: "APPROVED",
      verifiedBadge: false,
      profileCompleteness: 0,
      onboardingStep: 1,
      foundingAgency: false,
    },
  });
}

beforeAll(async () => {
  ({ prisma } = await import("@/lib/prisma"));
});

beforeEach(async () => {
  await prisma.review.deleteMany({});
  await prisma.enquiry.deleteMany({});
  await prisma.agency.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.rateLimitBucket.deleteMany({});
});

describe("POST /api/register (create account)", () => {
  // bcrypt cost 12 in the route makes this noticeably slower than a pure unit test.
  it("creates an employer account and refuses a duplicate", async () => {
    const { POST } = await import("@/app/api/register/route");
    const payload = {
      name: "API CRUD Employer",
      email: "api-crud-employer@example.test",
      password: "Valid-test-password-821!",
      accountType: "employer",
    };

    const created = await POST(post(payload));
    expect(created.status).toBe(201);
    const users = await prisma.user.findMany({});
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe("api-crud-employer@example.test");
    expect(users[0].role).toBe("VISITOR");
    expect(String(users[0].passwordHash)).toMatch(/^\$2[aby]\$/);

    const duplicate = await POST(post(payload, "203.0.113.11"));
    expect(duplicate.status).toBe(201);
    expect(await prisma.user.count()).toBe(1);
  }, 30_000);

  it("rejects an invalid payload without writing a row", async () => {
    const { POST } = await import("@/app/api/register/route");
    const response = await POST(
      post({ name: "x", email: "not-an-email", password: "short" }),
    );
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(await prisma.user.count()).toBe(0);
  }, 30_000);
});

describe("POST /api/enquiries (create leads)", () => {
  it("creates one enquiry per approved agency when allAgencies is set", async () => {
    await createAgency("api-crud-agency-one", "API Agency One");
    await createAgency("api-crud-agency-two", "API Agency Two");
    const { POST } = await import("@/app/api/enquiries/route");

    const response = await POST(
      post({
        allAgencies: true,
        name: "API CRUD Household",
        email: "api-crud-lead@example.test",
        phone: "+65 6000 2222",
        message: "We need a Filipino helper for newborn care from March.",
        consentGiven: "on",
        website: "",
      }),
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      message: "Your enquiry has been sent.",
    });

    const leads = await prisma.enquiry.findMany({});
    expect(leads).toHaveLength(2);
    // `status` falls back to the NEW column default on Postgres; the in-memory
    // client stores only what was written.
    expect(leads.every((lead) => (lead.status ?? "NEW") === "NEW")).toBe(true);
    expect(new Set(leads.map((lead) => lead.agencyId)).size).toBe(2);
    expect(leads[0].consentGiven).toBe(true);
    expect(String(leads[0].sourceIpHash).length).toBeGreaterThan(10);
  }, 30_000);

  it("rejects a lead without consent", async () => {
    await createAgency();
    const { POST } = await import("@/app/api/enquiries/route");
    const response = await POST(
      post({
        allAgencies: true,
        name: "No Consent",
        email: "no-consent@example.test",
        message: "This should be rejected.",
      }),
    );
    expect(response.status).toBe(400);
    expect(await prisma.enquiry.count()).toBe(0);
  }, 30_000);
});

describe("POST /api/reviews (create + moderate)", () => {
  it("creates a pending review, keeps it out of published reads, then publishes it", async () => {
    const agency = await createAgency();
    const { POST } = await import("@/app/api/reviews/route");

    const response = await POST(
      post({
        agencyId: agency.id,
        authorName: "API Reviewer",
        rating: 5,
        title: "API CRUD review",
        body: "Written by the automated API CRUD test.",
      }),
    );
    expect(response.status).toBe(201);

    const created = await prisma.review.findFirst({
      where: { agencyId: agency.id },
    });
    expect(created?.status).toBe("PENDING");
    expect(
      await prisma.review.count({
        where: { agencyId: agency.id, status: "PUBLISHED" },
      }),
    ).toBe(0);

    // Moderation (admin area) publishes it.
    await prisma.review.update({
      where: { id: created!.id },
      data: { status: "PUBLISHED" },
    });
    expect(
      await prisma.review.count({
        where: { agencyId: agency.id, status: "PUBLISHED" },
      }),
    ).toBe(1);

    await prisma.review.delete({ where: { id: created!.id } });
    expect(await prisma.review.count()).toBe(0);
  }, 30_000);

  it("returns 404 for an unknown agency", async () => {
    const { POST } = await import("@/app/api/reviews/route");
    const response = await POST(
      post({
        agencyId: "does-not-exist",
        authorName: "API Reviewer",
        rating: 4,
        title: "API CRUD review",
        body: "Written by the automated API CRUD test.",
      }),
    );
    expect(response.status).toBe(404);
    expect(await prisma.review.count()).toBe(0);
  }, 30_000);
});
