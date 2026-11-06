import { defineConfig, devices } from "@playwright/test";
import { mockDbFile } from "./e2e-display/mock-db";

/**
 * Display-only end-to-end run: no database is used. `lib/prisma.ts` falls back
 * to the in-memory client in `lib/prisma-mock.ts` because DATABASE_URL is empty,
 * and rows are mirrored to PRISMA_MOCK_FILE so specs can inspect them.
 *
 * Usage: npx playwright test -c playwright.display.config.ts
 */
const port = process.env.E2E_DISPLAY_PORT ?? "3100";
const host = "127.0.0.1";

export default defineConfig({
  testDir: "./e2e-display",
  outputDir: "test-results/display",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  // The mock store is shared and file-mirrored, so run the specs one at a time.
  fullyParallel: false,
  workers: 1,
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
        reuseExistingServer: false,
        timeout: 180_000,
        env: {
          ...process.env,
          // Forces the in-memory Prisma mock, so no database is ever contacted.
          PRISMA_MOCK: "true",
          // Belt and braces: even if the mock switch were missing, these point at
          // an unreachable local port instead of a real (production) database.
          DATABASE_URL: "postgresql://display-only@127.0.0.1:9/findmaids_display_only",
          DIRECT_URL: "postgresql://display-only@127.0.0.1:9/findmaids_display_only",
          PRISMA_MOCK_FILE: mockDbFile,
          APP_ENV: "test",
          NODE_ENV: "development",
          EMAIL_DELIVERY_DISABLED: "true",
          AI_PROVIDER: "mock",
          PAYMENT_PROVIDER: "mock",
          AUTH_SECRET: process.env.AUTH_SECRET ?? "display-only-e2e-secret",
          NEXTAUTH_SECRET:
            process.env.NEXTAUTH_SECRET ?? "display-only-e2e-secret",
          NEXTAUTH_URL: `http://${host}:${port}`,
          AUTH_URL: `http://${host}:${port}`,
          NEXT_PUBLIC_SITE_URL: `http://${host}:${port}`,
        },
      },
});
