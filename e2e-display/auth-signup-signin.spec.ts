import { expect, test } from "@playwright/test";
import {
  findUser,
  resetStore,
  rows,
  seedVerificationToken,
} from "./mock-db";

/**
 * Sign-up and sign-in coverage that runs in display-only mode: the app talks to
 * the in-memory Prisma mock (`lib/prisma-mock.ts`), never to a real database.
 */
const password = "Valid-test-password-821!";
const employerEmail = `signup-${Date.now()}@example.test`;
const agencyEmail = `signup-agency-${Date.now()}@example.test`;

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  // Buckets, users and tokens are per-run so rate limits never leak between runs.
  resetStore();
});

test("sign-up form requires a 10 character password", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Too Short");
  await page.getByLabel("Email").fill(`short-${Date.now()}@example.test`);
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  // The browser blocks the submit, so no request is made and no status appears.
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page).toHaveURL(/\/register$/);
});

test("creates an employer account from the sign-up form", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Playwright Employer");
  await page.getByLabel("Email").fill(employerEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByLabel("Employer").check();
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("status")).toContainText(
    "Account created. Check your email to verify it.",
  );

  const user = findUser(employerEmail);
  expect(user).not.toBeNull();
  expect(user?.role).toBe("VISITOR");
  expect(user?.emailVerified ?? null).toBeNull();
  // Stored as a bcrypt hash, never in plain text.
  expect(String(user?.passwordHash)).toMatch(/^\$2[aby]\$/);
  expect(
    rows("emailVerificationToken").some((row) => row.userId === user?.id),
  ).toBe(true);
  expect(
    rows("agencyOnboardingDraft").some((row) => row.userId === user?.id),
  ).toBe(false);
});

test("an unverified account cannot sign in", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(employerEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page.getByRole("status")).toContainText(
    "Email or password is incorrect, or your email is not verified.",
  );
  await expect(page).toHaveURL(/\/login/);
  const cookies = await page.context().cookies();
  expect(cookies.some((cookie) => /session-token/.test(cookie.name))).toBe(
    false,
  );
});

test("verifying the email then signing in creates a session", async ({
  page,
  request,
}) => {
  const user = findUser(employerEmail);
  expect(user).not.toBeNull();
  const token = seedVerificationToken(String(user?.id));

  const verification = await request.get(`/api/verify-email?token=${token}`, {
    maxRedirects: 0,
  });
  expect(verification.status()).toBe(307);
  expect(verification.headers()["location"]).toContain(
    "/login?verified=success",
  );
  expect(findUser(employerEmail)?.emailVerified).toBeInstanceOf(Date);

  await page.goto("/login");
  await page.getByLabel("Email").fill(employerEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page).toHaveURL(/\/$/);
  const cookies = await page.context().cookies();
  expect(cookies.some((cookie) => /session-token/.test(cookie.name))).toBe(
    true,
  );
});

test("a verified account is rejected with the wrong password", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(employerEmail);
  await page.getByLabel("Password").fill(`${password}-wrong`);
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page.getByRole("status")).toContainText(
    "Email or password is incorrect, or your email is not verified.",
  );
  await expect(page).toHaveURL(/\/login/);
});

test("duplicate sign-up stays neutral and creates no second account", async ({
  page,
}) => {
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Playwright Employer");
  await page.getByLabel("Email").fill(employerEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByLabel("Employer").check();
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("status")).toContainText(
    "If the address is eligible, verification instructions will be sent.",
  );
  const duplicates = rows("user").filter(
    (row) => String(row.email).toLowerCase() === employerEmail.toLowerCase(),
  );
  expect(duplicates).toHaveLength(1);
});

test("agency sign-up creates an onboarding draft and signs in as an agency", async ({
  page,
  request,
}) => {
  await page.goto("/register?type=agency");
  await page.getByLabel("Full name").fill("Playwright Agency Owner");
  await page.getByLabel("Email").fill(agencyEmail);
  await page.getByLabel("Password").fill(password);
  await expect(page.getByLabel("Agency")).toBeChecked();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Account created. Check your email to verify it.",
  );

  const user = findUser(agencyEmail);
  expect(user?.role).toBe("AGENCY");
  expect(
    rows("agencyOnboardingDraft").some((row) => row.userId === user?.id),
  ).toBe(true);

  const token = seedVerificationToken(String(user?.id));
  const verification = await request.get(`/api/verify-email?token=${token}`, {
    maxRedirects: 0,
  });
  expect(verification.status()).toBe(307);
  expect(verification.headers()["location"]).toContain("/agency/onboarding");

  await page.goto("/login");
  await page.getByLabel("Email").fill(agencyEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/$/);

  // The AGENCY role travels in the session, so agency-only pages open.
  await page.goto("/agency/onboarding");
  await expect(
    page.getByRole("heading", { name: "Tell families about your agency" }),
  ).toBeVisible();
});
