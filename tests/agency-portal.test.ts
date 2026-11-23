import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hash, compare } from "bcryptjs";
import type { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Agency portal navigation metadata + the new self-service password change.
 */
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
}));

process.env.PRISMA_MOCK = "true";
delete process.env.PRISMA_MOCK_FILE;

import { auth } from "@/auth";
import {
  HOME_ITEM,
  MENU_ITEMS,
  MORE_ITEMS,
  NAV_ITEMS,
  SHOW_NAV_ON_SUBPAGES,
  agencyMenuItem,
  LISTING_LINK_TOKEN,
} from "@/lib/agency-menu";

const authMock = vi.mocked(auth);
let prisma: PrismaClient;
let route: typeof import("@/app/api/agency/password/route");

const currentPassword = "Old-password-123";

function request(body: unknown) {
  return new Request("http://localhost/api/agency/password", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function createAgencyOwner(email: string) {
  const user = await prisma.user.create({
    data: {
      email,
      name: "Agency Owner",
      role: "AGENCY",
      passwordHash: await hash(currentPassword, 12),
      emailVerified: new Date(),
    },
  });
  const agency = await prisma.agency.create({
    data: {
      ownerId: user.id,
      name: "Portal Agency",
      slug: email.replace(/[^a-z0-9]+/g, "-"),
      description: "Agency used by the portal tests.",
      address: "1 Portal Road",
      city: "Singapore",
      province: "Central Region",
      phone: "+65 6000 0000",
      email,
      services: ["Full-time placement"],
      serviceLocations: ["Singapore"],
      nationalitiesServed: ["Filipino"],
      languages: ["English"],
      status: "APPROVED",
    },
  });
  return { user, agency };
}

beforeAll(async () => {
  ({ prisma } = await import("@/lib/prisma"));
  route = await import("@/app/api/agency/password/route");
});

beforeEach(async () => {
  authMock.mockReset();
  await prisma.auditLog.deleteMany({});
  await prisma.maid.deleteMany({});
  await prisma.agency.deleteMany({});
  await prisma.user.deleteMany({});
});

describe("agency menu config", () => {
  it("exposes the five home menu items in the reference order", () => {
    expect(MENU_ITEMS.map((item) => item.label)).toEqual([
      "Agency Profile",
      "Add Maids",
      "Edit/Delete Maids",
      "Change Password",
      "Employment Contracts & Forms",
    ]);
    expect(MENU_ITEMS.map((item) => item.path)).toEqual([
      "/agency/profile",
      "/agency/maids/new",
      "/agency/maids",
      "/agency/change-password",
      "/agency/forms",
    ]);
  });

  it("marks the forms item NEW and gives every item an icon and copy", () => {
    expect(agencyMenuItem("contracts").badge).toBe("NEW");
    for (const item of [...MENU_ITEMS, ...MORE_ITEMS]) {
      expect(item.icon).toBeTruthy();
      expect(item.description.length).toBeGreaterThan(0);
    }
  });

  it("keeps six nav links plus MORE and hides the nav on sub-pages", () => {
    expect(NAV_ITEMS.map((item) => item.navLabel)).toEqual([
      "HOME",
      "AGENCY PROFILE",
      "ADD MAIDS",
      "EDIT/DELETE MAIDS",
      "CHANGE PASSWORD",
      "ENQUIRIES",
    ]);
    expect(HOME_ITEM.path).toBe("/agency");
    expect(MORE_ITEMS.map((item) => item.path)).toEqual([
      "/agency/reviews",
      "/agency/billing",
      "/agency/advertising",
      "/agency/analytics",
      "/agency/ai-assistant",
      "/agency/account-settings",
    ]);
    expect(SHOW_NAV_ON_SUBPAGES).toBe(true);
  });

  it("keeps the public listing link token in the profile description", () => {
    expect(agencyMenuItem("profile").description[1]).toContain(
      LISTING_LINK_TOKEN,
    );
  });
});

describe("PATCH /api/agency/password", { timeout: 20_000 }, () => {
  it("requires an agency session", async () => {
    expect(
      (
        await route.PATCH(
          request({ currentPassword, newPassword: "New-password-123" }),
        )
      ).status,
    ).toBe(401);
    authMock.mockResolvedValue({
      user: { id: "u1", role: "VISITOR" },
      expires: "",
    } as never);
    expect(
      (
        await route.PATCH(
          request({ currentPassword, newPassword: "New-password-123" }),
        )
      ).status,
    ).toBe(401);
  });

  it("rejects a wrong current password, short and reused passwords without changing anything", async () => {
    const { user } = await createAgencyOwner("wrong@example.test");
    authMock.mockResolvedValue({
      user: { id: user.id, role: "AGENCY" },
      expires: "",
    } as never);

    const wrong = await route.PATCH(
      request({ currentPassword: "nope", newPassword: "New-password-123" }),
    );
    expect(wrong.status).toBe(400);
    expect(await wrong.json()).toMatchObject({
      error: "Current password is incorrect.",
    });

    expect(
      (await route.PATCH(request({ currentPassword, newPassword: "short" })))
        .status,
    ).toBe(400);
    expect(
      (
        await route.PATCH(
          request({ currentPassword, newPassword: currentPassword }),
        )
      ).status,
    ).toBe(400);

    const stored = await prisma.user.findUnique({ where: { id: user.id } });
    expect(await compare(currentPassword, stored!.passwordHash!)).toBe(true);
    expect(stored?.passwordChangedAt).toBeNull();
  });

  it("changes the password, stamps passwordChangedAt and audits the change", async () => {
    const { user, agency } = await createAgencyOwner("change@example.test");
    authMock.mockResolvedValue({
      user: { id: user.id, role: "AGENCY" },
      expires: "",
    } as never);

    const response = await route.PATCH(
      request({ currentPassword, newPassword: "New-password-456" }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      saved: true,
      reauthenticate: true,
    });

    const stored = await prisma.user.findUnique({ where: { id: user.id } });
    expect(await compare("New-password-456", stored!.passwordHash!)).toBe(true);
    expect(stored?.passwordChangedAt).toBeInstanceOf(Date);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "AGENCY_PASSWORD_CHANGED" },
    });
    expect(audit?.userId).toBe(user.id);
    expect(audit?.agencyId).toBe(agency.id);
  });
});
