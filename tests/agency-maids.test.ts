import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Agency maid roster CRUD: an agency owner can add, edit, publish/hide and
 * delete its own maid profiles, and never another agency's.
 *
 * Runs against the in-memory Prisma client (no DATABASE_URL), with `auth()`
 * and the rate limiter stubbed. Middleware-level CSRF/session gating is covered
 * by `middleware.ts` and exercised by the Playwright specs.
 */
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
}));

process.env.PRISMA_MOCK = "true";
delete process.env.PRISMA_MOCK_FILE;
delete process.env.REDIS_URL;

import { auth } from "@/auth";
import { AGENCY_MAID_LIMIT } from "@/lib/maids";

let prisma: PrismaClient;
let collection: typeof import("@/app/api/agency/maids/route");
let item: typeof import("@/app/api/agency/maids/[maidId]/route");

const authMock = vi.mocked(auth);

const agencyBase = {
  description: "Agency used by the maid roster tests.",
  address: "1 Maid Road",
  city: "Singapore",
  province: "Central Region",
  phone: "+65 6000 4444",
  email: "maid-owner@example.test",
  services: ["Full-time placement"],
  serviceLocations: ["Singapore"],
  nationalitiesServed: ["Filipino"],
  languages: ["English"],
  status: "APPROVED" as const,
  verifiedBadge: false,
  profileCompleteness: 0,
  onboardingStep: 1,
  foundingAgency: false,
};

const maidBody = {
  reference: "S-1001",
  nationality: "Filipino",
  age: 29,
  languages: ["English", "Tagalog"],
  placementType: "Full-time placement",
  experienceYears: 4,
  duties: ["Housekeeping"],
  monthlySalary: 620,
  status: "AVAILABLE" as const,
};

function session(userId: string, role = "AGENCY") {
  return {
    user: { id: userId, role, email: "owner@example.test" },
    expires: "",
  };
}

function request(body?: unknown, method = "POST") {
  return new Request("http://localhost/api/agency/maids", {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function createOwner(email: string, name: string) {
  const user = await prisma.user.create({ data: { email, name } });
  const agency = await prisma.agency.create({
    data: {
      ...agencyBase,
      ownerId: user.id,
      name,
      slug: email.replace(/[^a-z0-9]+/g, "-"),
      email,
    },
  });
  return { user, agency };
}

beforeAll(async () => {
  ({ prisma } = await import("@/lib/prisma"));
  collection = await import("@/app/api/agency/maids/route");
  item = await import("@/app/api/agency/maids/[maidId]/route");
});

beforeEach(async () => {
  authMock.mockReset();
  await prisma.auditLog.deleteMany({});
  await prisma.maid.deleteMany({});
  await prisma.agency.deleteMany({});
  await prisma.user.deleteMany({});
});

describe("GET /api/agency/maids", () => {
  it("rejects anonymous and non-agency sessions", async () => {
    expect((await collection.GET()).status).toBe(401);
    authMock.mockResolvedValue(session("u1", "VISITOR") as never);
    expect((await collection.GET()).status).toBe(401);
  });

  it("returns only the caller's maids", async () => {
    const mine = await createOwner("mine@example.test", "Mine Agency");
    const other = await createOwner("other@example.test", "Other Agency");
    await prisma.maid.create({
      data: { ...maidBody, agencyId: mine.agency.id, reference: "MINE-1" },
    });
    await prisma.maid.create({
      data: { ...maidBody, agencyId: other.agency.id, reference: "OTHER-1" },
    });
    authMock.mockResolvedValue(session(mine.user.id) as never);
    const response = await collection.GET();
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      maids: { reference: string }[];
      limit: number;
    };
    expect(body.maids.map((maid) => maid.reference)).toEqual(["MINE-1"]);
    expect(body.limit).toBe(AGENCY_MAID_LIMIT);
  });
});

describe("POST /api/agency/maids", () => {
  it("creates a published, non-sample maid for the caller's agency", async () => {
    const owner = await createOwner("create@example.test", "Create Agency");
    authMock.mockResolvedValue(session(owner.user.id) as never);
    const response = await collection.POST(request(maidBody));
    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      maid: {
        id: string;
        agencyId: string;
        published: boolean;
        isSample: boolean;
      };
    };
    expect(body.maid.agencyId).toBe(owner.agency.id);
    expect(body.maid.published).toBe(true);
    expect(body.maid.isSample).toBe(false);
    const stored = await prisma.maid.findFirst({
      where: { reference: "S-1001" },
    });
    expect(stored?.monthlySalary).toBe(620);
    expect(stored?.languages).toEqual(["English", "Tagalog"]);
    const audit = await prisma.auditLog.findFirst({
      where: { action: "MAID_CREATED" },
    });
    expect(audit?.entityId).toBe(body.maid.id);
  });

  it("keeps a hidden profile out of the public read path", async () => {
    const owner = await createOwner("hidden@example.test", "Hidden Agency");
    authMock.mockResolvedValue(session(owner.user.id) as never);
    const created = await collection.POST(
      request({ ...maidBody, published: false }),
    );
    expect(created.status).toBe(201);
    const { publishedMaidWhere } = await import("@/lib/maids");
    expect(
      await prisma.maid.count({ where: publishedMaidWhere(owner.agency.id) }),
    ).toBe(0);
    expect(
      await prisma.maid.count({ where: { agencyId: owner.agency.id } }),
    ).toBe(1);
  });

  it("refuses a duplicate reference and invalid values", async () => {
    const owner = await createOwner("dup@example.test", "Dup Agency");
    authMock.mockResolvedValue(session(owner.user.id) as never);
    expect((await collection.POST(request(maidBody))).status).toBe(201);
    const duplicate = await collection.POST(request(maidBody));
    expect(duplicate.status).toBe(409);
    await expect(duplicate.json()).resolves.toMatchObject({
      error: "That reference is already used by another maid profile.",
    });
    const invalid = await collection.POST(
      request({ ...maidBody, reference: "S-1002", age: 12 }),
    );
    expect(invalid.status).toBe(400);
    const missingLanguages = await collection.POST(
      request({ ...maidBody, reference: "S-1003", languages: [] }),
    );
    expect(missingLanguages.status).toBe(400);
    expect(await prisma.maid.count()).toBe(1);
  });

  it("stops at the agency profile limit", async () => {
    const owner = await createOwner("limit@example.test", "Limit Agency");
    authMock.mockResolvedValue(session(owner.user.id) as never);
    for (let index = 0; index < AGENCY_MAID_LIMIT; index += 1) {
      await prisma.maid.create({
        data: {
          ...maidBody,
          agencyId: owner.agency.id,
          reference: `LIMIT-${index}`,
        },
      });
    }
    const response = await collection.POST(
      request({ ...maidBody, reference: "LIMIT-OVER" }),
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: `You can keep up to ${AGENCY_MAID_LIMIT} maid profiles. Remove one to add another.`,
    });
  });
});

describe("PATCH /api/agency/maids/[maidId]", () => {
  it("updates status, salary and visibility for the owner", async () => {
    const owner = await createOwner("patch@example.test", "Patch Agency");
    const maid = await prisma.maid.create({
      data: { ...maidBody, agencyId: owner.agency.id },
    });
    authMock.mockResolvedValue(session(owner.user.id) as never);
    const response = await item.PATCH(
      request(
        { status: "PLACED", monthlySalary: 700, published: false },
        "PATCH",
      ),
      { params: Promise.resolve({ maidId: maid.id }) },
    );
    expect(response.status).toBe(200);
    const stored = await prisma.maid.findUnique({ where: { id: maid.id } });
    expect(stored?.status).toBe("PLACED");
    expect(stored?.monthlySalary).toBe(700);
    expect(stored?.published).toBe(false);
    const audit = await prisma.auditLog.findFirst({
      where: { action: "MAID_UPDATED" },
    });
    expect(audit?.entityId).toBe(maid.id);
  });

  it("stores the full biodata fields from the agency sheet", async () => {
    const owner = await createOwner("biodata@example.test", "Biodata Agency");
    const maid = await prisma.maid.create({
      data: { ...maidBody, agencyId: owner.agency.id },
    });
    authMock.mockResolvedValue(session(owner.user.id) as never);
    const response = await item.PATCH(
      request(
        {
          fullName: "Zin Mar Win",
          dateOfBirth: "1999-05-11",
          placeOfBirth: "Myingyan",
          heightCm: 150,
          weightKg: 52,
          religion: "Buddhist",
          maritalStatus: "Single",
          childrenCount: 0,
          siblingsCount: 5,
          homeAddress: "Magway",
          airportRepatriation: "Yangon",
          educationLevel: "High School (10-12 yrs)",
          languageSkills: { English: "Fair", Hindi: "Zero" },
          preferences: {
            sgExperience: true,
            offDaysPerMonth: "2",
            availabilityInterviewOptions: ["FDW can be interviewed by phone"],
            otherInformation: { "Able to eat pork?": true },
          },
          workAreas: {
            Cooking: {
              rating: 4,
              note: "Chinese food",
              willing: true,
              experience: true,
            },
          },
          employmentHistory: [{ from: "2019", to: "2022", country: "Myanmar" }],
          introduction: "Dedicated helper with childcare experience.",
          medicalInfo: {
            pastIllnesses: { "(III) Asthma": false },
            otherRemarks: "No medical conditions stated.",
          },
          agencyContact: { phone: "80730757", licenseNo: "2503114" },
          photoUrls: ["/uploads/maids/agency-1/9685/photos/photo-1.jpg"],
          expectedSalary: 600,
          presentSalary: 510,
          availability: "FDW can be interviewed by phone",
          published: true,
        },
        "PATCH",
      ),
      { params: Promise.resolve({ maidId: maid.id }) },
    );
    expect(response.status).toBe(200);
    const stored = await prisma.maid.findUnique({ where: { id: maid.id } });
    expect(stored?.fullName).toBe("Zin Mar Win");
    expect(stored?.heightCm).toBe(150);
    expect(stored?.weightKg).toBe(52);
    expect(stored?.religion).toBe("Buddhist");
    expect(stored?.educationLevel).toBe("High School (10-12 yrs)");
    expect(stored?.expectedSalary).toBe(600);
    expect(stored?.photoUrls).toEqual([
      "/uploads/maids/agency-1/9685/photos/photo-1.jpg",
    ]);
    expect(stored?.age).toBeGreaterThan(20);
    expect((stored?.languageSkills as Record<string, string>).English).toBe(
      "Fair",
    );
    expect(
      (stored?.workAreas as { Cooking: { rating: number } }).Cooking.rating,
    ).toBe(4);
    expect((stored?.medicalInfo as { otherRemarks: string }).otherRemarks).toBe(
      "No medical conditions stated.",
    );
    expect((stored?.agencyContact as { licenseNo: string }).licenseNo).toBe(
      "2503114",
    );
  });

  it("hides another agency's maid behind a 404", async () => {
    const owner = await createOwner("patch-owner@example.test", "Patch Owner");
    const intruder = await createOwner("intruder@example.test", "Intruder");
    const maid = await prisma.maid.create({
      data: { ...maidBody, agencyId: owner.agency.id, published: true },
    });
    authMock.mockResolvedValue(session(intruder.user.id) as never);
    const response = await item.PATCH(request({ published: false }, "PATCH"), {
      params: Promise.resolve({ maidId: maid.id }),
    });
    expect(response.status).toBe(404);
    expect(
      (await prisma.maid.findUnique({ where: { id: maid.id } }))?.published,
    ).toBe(true);
  });

  it("rejects an empty payload and a duplicate reference", async () => {
    const owner = await createOwner("patch-dup@example.test", "Patch Dup");
    const first = await prisma.maid.create({
      data: { ...maidBody, agencyId: owner.agency.id, reference: "A-1" },
    });
    await prisma.maid.create({
      data: { ...maidBody, agencyId: owner.agency.id, reference: "A-2" },
    });
    authMock.mockResolvedValue(session(owner.user.id) as never);
    expect(
      (
        await item.PATCH(request({}, "PATCH"), {
          params: Promise.resolve({ maidId: first.id }),
        })
      ).status,
    ).toBe(400);
    const clash = await item.PATCH(request({ reference: "A-2" }, "PATCH"), {
      params: Promise.resolve({ maidId: first.id }),
    });
    expect(clash.status).toBe(409);
  });
});

describe("DELETE /api/agency/maids/[maidId]", () => {
  it("deletes the owner's maid and audits the removal", async () => {
    const owner = await createOwner("delete@example.test", "Delete Agency");
    const maid = await prisma.maid.create({
      data: { ...maidBody, agencyId: owner.agency.id },
    });
    authMock.mockResolvedValue(session(owner.user.id) as never);
    const response = await item.DELETE(request(undefined, "DELETE"), {
      params: Promise.resolve({ maidId: maid.id }),
    });
    expect(response.status).toBe(200);
    expect(await prisma.maid.count()).toBe(0);
    const audit = await prisma.auditLog.findFirst({
      where: { action: "MAID_DELETED" },
    });
    expect(audit?.entityId).toBe(maid.id);
  });

  it("refuses to delete another agency's maid", async () => {
    const owner = await createOwner(
      "delete-owner@example.test",
      "Delete Owner",
    );
    const intruder = await createOwner(
      "delete-intruder@example.test",
      "Intruder",
    );
    const maid = await prisma.maid.create({
      data: { ...maidBody, agencyId: owner.agency.id },
    });
    authMock.mockResolvedValue(session(intruder.user.id) as never);
    const response = await item.DELETE(request(undefined, "DELETE"), {
      params: Promise.resolve({ maidId: maid.id }),
    });
    expect(response.status).toBe(404);
    expect(await prisma.maid.count()).toBe(1);
  });
});
