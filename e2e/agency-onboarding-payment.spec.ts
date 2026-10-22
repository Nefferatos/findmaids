import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

const prisma = new PrismaClient();
const onboarding = {
  name: "E2E Household Agency",
  slug: "e2e-household-agency",
  description:
    "A fictional agency profile created for end-to-end testing and local development only.",
  yearEstablished: 2015,
  licenseNumber: "E2E-TEST-001",
  address: "10 Test Street",
  city: "Makati",
  province: "Metro Manila",
  phone: "+639171234567",
  whatsapp: "+639171234567",
  email: "e2e-agency@example.test",
  website: "https://example.test",
  facebook: "https://facebook.com/example.test",
  services: ["Full-time placement"],
  nationalitiesServed: ["Filipino"],
  languages: ["Filipino", "English"],
  photos: [],
};

test("agency registration, onboarding, approval, mock checkout and featured listing", async ({
  page,
  request,
}) => {
  test.skip(
    process.env.E2E_PAYMENT_FLOW !== "1",
    "Set E2E_PAYMENT_FLOW=1 with a migrated test database and Playwright Chromium.",
  );
  const unique = Date.now();
  const email = `agency-${unique}@example.test`;
  const password = "Valid-e2e-agency-password-820!";
  const slug = `e2e-agency-${unique}`;

  try {
    await page.goto("/register?type=agency");
    await page.getByLabel("Full name").fill("E2E Agency Owner");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("status")).toContainText("Account created");

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const token = `e2e-agency-verification-${unique}-long-token`;
    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const verification = await request.get(`/api/verify-email?token=${token}`, {
      maxRedirects: 0,
    });
    expect(verification.status()).toBe(307);
    expect(verification.headers().location).toContain("/agency/onboarding");

    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/agency\/onboarding/);

    await page.request.put("/api/agency/onboarding", {
      data: { data: { ...onboarding, slug }, currentStep: 5 },
    });
    const submission = await page.request.post("/api/agency/onboarding", {
      data: { ...onboarding, slug },
    });
    expect(submission.status()).toBe(201);
    const agency = await prisma.agency.findUniqueOrThrow({ where: { slug } });
    expect(agency.status).toBe("PENDING");

    const basic = await prisma.plan.upsert({
      where: { name: "Basic Free" },
      update: {},
      create: {
        name: "Basic Free",
        priceMonthly: 0,
        priceYearly: 0,
        features: [],
        listingPriority: 0,
        featuredSlots: 0,
        maxPhotos: 3,
        leadLimit: 10,
      },
    });
    await prisma.agency.update({
      where: { id: agency.id },
      data: { status: "APPROVED" },
    });
    await prisma.subscription.create({
      data: {
        id: `e2e-basic-${agency.id}`,
        agencyId: agency.id,
        planId: basic.id,
        status: "ACTIVE",
        startDate: new Date(),
        billingPeriod: "MONTHLY",
      },
    });
    const gold = await prisma.plan.upsert({
      where: { name: "Gold" },
      update: {},
      create: {
        name: "Gold",
        priceMonthly: 999,
        priceYearly: 9990,
        features: ["Priority profile"],
        listingPriority: 10,
        featuredSlots: 1,
        maxPhotos: 10,
        leadLimit: 100,
      },
    });

    await page.goto("/agency/dashboard?view=billing");
    await page.goto(`/agency/billing/checkout?plan=${gold.id}`);
    await page
      .getByRole("button", { name: "Continue to secure checkout" })
      .click();
    await expect(page).toHaveURL(/mockPayment=/);
    const paymentId = new URL(page.url()).searchParams.get("mockPayment");
    expect(paymentId).toBeTruthy();
    const webhook = await request.post("/api/webhooks/paymongo", {
      headers: {
        "paymongo-signature":
          process.env.PAYMENT_WEBHOOK_SECRET ?? "local-mock-secret-change-me",
      },
      data: {
        eventId: `e2e-payment-${unique}`,
        type: "payment.paid",
        paymentReference: paymentId,
        status: "paid",
      },
    });
    expect(webhook.ok()).toBe(true);
    await page.goto("/");
    await expect(page.getByText("Featured / Sponsored").first()).toBeVisible();
  } finally {
    const cleanupAgency = await prisma.agency.findUnique({ where: { slug } });
    if (cleanupAgency)
      await prisma.agency.delete({ where: { id: cleanupAgency.id } });
    await prisma.user.deleteMany({ where: { email } });
  }
});
