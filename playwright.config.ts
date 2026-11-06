import { defineConfig, devices } from "@playwright/test";
import {
  assertStagingWriteAllowed,
  loadEnvFile,
} from "./lib/security/staging-guard";

// Single environment file — there is no .env.staging / .env.test any more.
loadEnvFile(".env");
// The database-backed specs write rows, so they only run when APP_ENV marks the
// target as test/staging (`$env:APP_ENV="test"` before `npm run test:e2e`).
assertStagingWriteAllowed();

const port = process.env.E2E_PORT ?? "3000";
// `next dev` reports its origin as localhost, which the same-origin CSRF guard compares against.
const host = "localhost";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? `http://${host}:${port}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- --port ${port}`,
        url: `http://${host}:${port}/login`,
        reuseExistingServer: !process.env.CI,
        env: {
          ...process.env,
          EMAIL_DELIVERY_DISABLED: "true",
        },
        timeout: 120_000,
      },
});
