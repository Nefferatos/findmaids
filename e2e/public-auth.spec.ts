import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

test("directory is browseable and role-protected areas redirect visitors", async ({
  page,
}) => {
  await page.goto("/agencies");
  await expect(
    page.getByRole("heading", { name: "Find an agency" }),
  ).toBeVisible();
  await page.goto("/agency/dashboard");
  await expect(page).toHaveURL(/\/login\?callbackUrl=/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\?callbackUrl=/);
});

test("registration form offers employer and agency roles", async ({ page }) => {
  await page.goto("/register");
  await expect(
    page.getByRole("heading", { name: "Create an account" }),
  ).toBeVisible();
  await expect(page.getByLabel("Employer")).toBeVisible();
  await expect(page.getByLabel("Agency")).toBeVisible();
});

test("register, verify email, then log in", async ({ page, request }) => {
  const email = `e2e-${Date.now()}@example.test`;
  const password = "Valid-test-password-821!";
  const response = await request.post("/api/register", {
    data: { name: "E2E User", email, password, accountType: "employer" },
  });
  expect(response.status()).toBe(201);

  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const rawToken = `e2e-verification-${Date.now()}-token`;
  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash: createHash("sha256").update(rawToken).digest("hex"),
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  const verification = await request.get(
    `/api/verify-email?token=${rawToken}`,
    {
      maxRedirects: 0,
    },
  );
  expect(verification.status()).toBe(307);
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/$/);
  await prisma.user.delete({ where: { id: user.id } });
});

test("seeded agency profile enquiry flow", async ({ page }) => {
  const slug = process.env.E2E_AGENCY_SLUG;
  test.skip(!slug, "Set E2E_AGENCY_SLUG to an approved seeded agency slug.");
  await page.goto(`/agencies/${slug}`);
  await expect(
    page.getByRole("heading", { name: "Contact this agency" }),
  ).toBeVisible();
  await page.getByLabel("Name", { exact: true }).fill("E2E Visitor");
  await page.getByLabel("Email", { exact: true }).fill("e2e@example.test");
  await page
    .getByLabel("Message", { exact: true })
    .fill("Please share more information about your services.");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Send enquiry" }).click();
  await expect(page.getByRole("status")).toContainText("enquiry has been sent");
});
