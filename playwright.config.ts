import { defineConfig, devices } from "@playwright/test";
import { assertStagingWriteAllowed, loadEnvFile } from "./lib/security/staging-guard";

if (process.env.E2E_STAGING === "1") loadEnvFile(".env.staging");
// E2E specs write to the database, so refuse to run unless it is a verified staging/test target.
assertStagingWriteAllowed();

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://127.0.0.1:3000/login",
        reuseExistingServer: !process.env.CI && process.env.E2E_STAGING !== "1",
        env: { ...process.env, EMAIL_DELIVERY_DISABLED: "true" },
        timeout: 120_000,
      },
});
