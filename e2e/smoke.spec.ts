import { expect, test } from "@playwright/test";

test("public launch pages render and expose required policies", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: /privacy/i })).toBeVisible();

  await page.goto("/agencies");
  await expect(page.getByRole("heading", { name: "Find an agency" })).toBeVisible();

  await page.goto("/cookies");
  await expect(page.getByRole("heading", { name: "Cookie policy" })).toBeVisible();

  await page.goto("/.well-known/security.txt");
  await expect(page.locator("body")).toContainText("security@findmaids.ph");
});
