import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const cronSecret = process.env.CRON_SECRET;
const isolated = process.env.E2E_STEP7_DATABASE_ISOLATED === "1";

test.skip(!adminEmail || !adminPassword || !cronSecret || !isolated, "Requires explicit admin credentials, cron secret, and a disposable isolated Step 7 database.");

test("prospect links to a free listing, founding grant expires and downgrades without charge", async ({ page }) => {
  const unique = Date.now();
  const slug = `e2e-founding-${unique}`;
  const prospectName = `E2E Founding Agency ${unique}`;
  let agencyId: string | undefined;
  let prospectId: string | undefined;
  try {
    const basic = await prisma.plan.findUniqueOrThrow({ where: { name: "Basic Free" }, select: { id: true } });
    const agency = await prisma.agency.create({
      data: {
        name: prospectName,
        slug,
        description: "Temporary E2E agency profile used only in an isolated disposable test database.",
        address: "1 E2E Test Road",
        city: "Makati",
        province: "Metro Manila",
        phone: "+639171234567",
        email: `agency-${unique}@example.test`,
        services: ["Full-time placement"],
        nationalitiesServed: ["Filipino"],
        languages: ["English"],
        status: "APPROVED",
      },
      select: { id: true },
    });
    agencyId = agency.id;

    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(adminEmail!);
    await page.getByLabel("Password", { exact: true }).fill(adminPassword!);
    if (process.env.E2E_ADMIN_TOTP) await page.getByLabel(/authenticator code/i).fill(process.env.E2E_ADMIN_TOTP);
    await page.getByRole("button", { name: /log in/i }).click();
    await page.goto("/admin/prospects");

    const create = await page.request.post("/api/admin/prospects", { data: {
      agencyName: prospectName,
      contactName: "E2E Contact",
      email: `contact-${unique}@example.test`,
      city: "Makati",
      licenseNumber: `E2E-${unique}`,
      licenseSource: "Isolated test fixture",
      contactDetailsSource: "Synthetic E2E fixture",
      source: "E2E",
      nextActionAt: new Date(Date.now() + 86_400_000).toISOString(),
    } });
    expect(create.status()).toBe(201);
    prospectId = (await create.json()).prospect.id;

    const linked = await page.request.patch("/api/admin/prospects", { data: { id: prospectId, agencyId, stage: "LISTED_FREE" } });
    expect(linked.ok()).toBe(true);
    await expect(page.getByText(prospectName)).toBeVisible();

    const grant = await page.request.post("/api/admin/founding-agencies", { data: { action: "grant", agencyId, days: 90, reason: "Disposable automated founding period test" } });
    expect(grant.ok()).toBe(true);
    const activeFounding = await prisma.subscription.findFirstOrThrow({ where: { agencyId, foundingAgency: true, status: "ACTIVE" } });
    expect(activeFounding.planId).not.toBe(basic.id);

    const expiredAt = new Date(Date.now() - 60_000);
    await prisma.subscription.update({ where: { id: activeFounding.id }, data: { endDate: expiredAt, foundingPeriodEndsAt: expiredAt } });
    await prisma.agency.update({ where: { id: agencyId }, data: { foundingPeriodEndsAt: expiredAt } });
    const cron = await page.request.get("/api/cron/subscriptions", { headers: { Authorization: `Bearer ${cronSecret}` } });
    expect(cron.ok()).toBe(true);
    const downgraded = await prisma.subscription.findUniqueOrThrow({ where: { id: activeFounding.id }, select: { planId: true, foundingAgency: true } });
    expect(downgraded).toEqual({ planId: basic.id, foundingAgency: false });
  } finally {
    if (prospectId) await prisma.prospect.deleteMany({ where: { id: prospectId } });
    if (agencyId) await prisma.agency.deleteMany({ where: { id: agencyId } });
  }
});

test.afterAll(async () => prisma.$disconnect());
