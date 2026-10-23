import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";

const prisma = new PrismaClient();
const slug = process.env.E2E_AGENCY_SLUG;
const agencyEmail = process.env.E2E_AGENCY_EMAIL;
const agencyPassword = process.env.E2E_AGENCY_PASSWORD;
const e2eReady = Boolean(slug && agencyEmail && agencyPassword);

test.skip(
  !e2eReady,
  "Set E2E_AGENCY_SLUG, E2E_AGENCY_EMAIL and E2E_AGENCY_PASSWORD against a migrated isolated database.",
);

test("visitor chat to consented enquiry to agency-approved reply", async ({
  page,
}) => {
  const agency = await prisma.agency.findUniqueOrThrow({
    where: { slug: slug! },
    select: { id: true, city: true },
  });
  const flagSetting = await prisma.adminSetting.findUnique({
    where: { key: "featureFlags" },
    select: { value: true },
  });
  const agencySettings = await prisma.agencyAiSettings.findUnique({
    where: { agencyId: agency.id },
  });
  const flags =
    flagSetting?.value && typeof flagSetting.value === "object"
      ? (flagSetting.value as Record<string, unknown>)
      : {};
  const email = `e2e-chat-${Date.now()}@example.test`;
  const capPlanName = `E2E Cap ${Date.now()}`;
  let capSubscriptionId: string | undefined;
  let capPlanId: string | undefined;
  let consentHash: string | undefined;
  try {
    const capPlan = await prisma.plan.create({
      data: {
        name: capPlanName,
        priceMonthly: 0,
        priceYearly: 0,
        features: ["E2E cap policy"],
        listingPriority: 0,
        featuredSlots: 0,
        maxPhotos: 3,
        leadLimit: 0,
      },
      select: { id: true },
    });
    capPlanId = capPlan.id;
    const capSubscription = await prisma.subscription.create({
      data: {
        agencyId: agency.id,
        planId: capPlan.id,
        status: "ACTIVE",
        startDate: new Date(),
        billingPeriod: "MONTHLY",
        autoRenew: false,
      },
      select: { id: true },
    });
    capSubscriptionId = capSubscription.id;
    await prisma.adminSetting.upsert({
      where: { key: "featureFlags" },
      create: {
        key: "featureFlags",
        value: { ...flags, employer_assistant: true, agency_auto_reply: true },
      },
      update: {
        value: { ...flags, employer_assistant: true, agency_auto_reply: true },
      },
    });
    await prisma.agencyAiSettings.upsert({
      where: { agencyId: agency.id },
      create: {
        agencyId: agency.id,
        autoReplyEnabled: true,
        replyMode: "DRAFT",
        languages: ["English"],
      },
      update: { autoReplyEnabled: true, replyMode: "DRAFT" },
    });
    await page.goto(
      "/?utm_source=facebook&utm_medium=community&utm_campaign=e2e-step7",
    );
    const allowAnalytics = page.getByRole("button", {
      name: "Allow analytics",
    });
    if (await allowAnalytics.isVisible()) await allowAnalytics.click();
    await page.getByRole("button", { name: /assistant/i }).click();
    await page.getByLabel(/message/i).fill(`I need a nanny in ${agency.city}`);
    await page.getByRole("button", { name: /send/i }).click();
    await page.getByRole("button", { name: /enquire/i }).click();
    await page.getByLabel(/agency/i).selectOption(agency.id);
    await page.getByLabel(/name/i).fill("E2E Visitor");
    await page.getByLabel(/email/i).fill(email);
    await page
      .getByLabel(/enquiry message/i)
      .fill("Please contact me about nanny services and budget PHP 12000.");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /send enquiry/i }).click();
    await expect(
      page.getByText(/Thank you\. Your enquiry was sent to the agency/),
    ).toBeVisible({ timeout: 30000 });
    await expect
      .poll(
        () =>
          prisma.enquiry.findFirst({
            where: { email },
            select: {
              id: true,
              source: true,
              aiSummary: true,
              acquisitionSource: true,
            },
          }),
        { timeout: 30000 },
      )
      .toMatchObject({
        source: "CHAT",
        acquisitionSource: expect.objectContaining({
          sourceCategory: "FACEBOOK",
          utmCampaign: "e2e-step7",
        }),
      });
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(agencyEmail!);
    await page.getByLabel(/password/i).fill(agencyPassword!);
    await page.getByRole("button", { name: /log in/i }).click();
    await page.goto("/agency/dashboard?view=leads");
    await expect(page.getByText(email)).toBeVisible();
    await expect(
      page.getByText(/above your current plan allowance/i),
    ).toBeVisible();
    await expect(page.getByText(/summary:/i)).toBeVisible({ timeout: 30000 });
    await page
      .getByRole("button", { name: /suggest reply/i })
      .first()
      .click();
    await expect(
      page.getByLabel(/editable reply draft/i).first(),
    ).toBeVisible();
    const lead = await prisma.enquiry.findFirstOrThrow({
      where: { email },
      select: { aiReplySentAt: true },
    });
    expect(lead.aiReplySentAt).toBeNull();
    const sourceReport = await page.request.get(
      "/api/agency/leads/source-summary",
    );
    expect(sourceReport.ok()).toBe(true);
    expect((await sourceReport.json()).bySource.FACEBOOK).toBeGreaterThan(0);
    const visitorCookie = (await page.context().cookies()).find(
      (cookie) => cookie.name === "fm-cookie-consent-id",
    );
    if (visitorCookie)
      consentHash = createHash("sha256")
        .update(visitorCookie.value)
        .digest("hex");
  } finally {
    await prisma.enquiry.deleteMany({ where: { email } });
    if (consentHash)
      await prisma.cookieConsent.deleteMany({
        where: { consentKeyHash: consentHash },
      });
    if (capSubscriptionId)
      await prisma.subscription.delete({ where: { id: capSubscriptionId } });
    if (capPlanId) await prisma.plan.delete({ where: { id: capPlanId } });
    if (agencySettings)
      await prisma.agencyAiSettings.update({
        where: { agencyId: agency.id },
        data: {
          autoReplyEnabled: agencySettings.autoReplyEnabled,
          replyMode: agencySettings.replyMode,
          replyTone: agencySettings.replyTone,
          languages: agencySettings.languages,
          escalationEmail: agencySettings.escalationEmail,
          knowledgeBase: agencySettings.knowledgeBase,
          businessHours: agencySettings.businessHours ?? undefined,
        },
      });
    else
      await prisma.agencyAiSettings.deleteMany({
        where: { agencyId: agency.id },
      });
    if (flagSetting && flagSetting.value !== null)
      await prisma.adminSetting.update({
        where: { key: "featureFlags" },
        data: {
          value:
            flagSetting.value as import("@prisma/client").Prisma.InputJsonValue,
        },
      });
    else
      await prisma.adminSetting.deleteMany({ where: { key: "featureFlags" } });
  }
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
