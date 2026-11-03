import { defineConfig, devices } from "@playwright/test";
import { assertStagingWriteAllowed, loadEnvFile } from "./lib/security/staging-guard";

if (process.env.E2E_STAGING === "1") loadEnvFile(".env.staging");
// E2E specs write to the database, so refuse to run unless it is a verified staging/test target.
assertStagingWriteAllowed();

const port = process.env.E2E_PORT ?? "3000";
const separateServer = process.env.E2E_STAGING === "1" && port !== "3000";
// `next dev` reports its origin as localhost, which the same-origin CSRF guard compares against.
const host = separateServer ? "localhost" : "127.0.0.1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: !separateServer,
  workers: separateServer ? 1 : undefined,
  // The staging dev server compiles each page on first request, so allow more time.
  ...(separateServer ? { timeout: 120_000, expect: { timeout: 20_000 } } : {}),
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
        reuseExistingServer: !process.env.CI && process.env.E2E_STAGING !== "1",
        env: {
          ...process.env,
          EMAIL_DELIVERY_DISABLED: "true",
          ...(separateServer
            ? { NEXT_DIST_DIR: ".next-staging", NEXTAUTH_URL: `http://${host}:${port}`, NEXT_PUBLIC_SITE_URL: `http://${host}:${port}` }
            : {}),
        },
        timeout: 120_000,
      },
});
