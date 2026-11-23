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

// `assertStagingWriteAllowed` trusts STAGING_PROJECT_REF, and the local `.env`
// points at the same Supabase project the Worker deploys against. These extra
// checks make a destructive target explicit: a remote database or a deployed
// base URL is refused unless the matching E2E_ALLOW_* flag is set. Without them
// a mistaken run leaves "E2E …"/"Demo …" agencies on the live site.
const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

function hostOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase().replace(/^\[|\]$/g, "");
  } catch {
    return null;
  }
}

function e2eTargetProblems(): string[] {
  const problems: string[] = [];
  const dbHost = hostOf(process.env.DIRECT_URL ?? process.env.DATABASE_URL);
  if (dbHost && !localHosts.has(dbHost) && process.env.E2E_ALLOW_REMOTE_DB !== "1")
    problems.push(
      `database host "${dbHost}" is not local — set E2E_ALLOW_REMOTE_DB=1 only for a disposable staging database`,
    );
  const appHost = hostOf(process.env.PLAYWRIGHT_BASE_URL);
  if (appHost && !localHosts.has(appHost) && process.env.E2E_ALLOW_REMOTE_URL !== "1")
    problems.push(
      `PLAYWRIGHT_BASE_URL host "${appHost}" is not local — set E2E_ALLOW_REMOTE_URL=1 only for a disposable deploy preview`,
    );
  return problems;
}

const e2eProblems = e2eTargetProblems();
if (e2eProblems.length)
  throw new Error(
    `Refusing to run browser E2E against a possible production target:\n- ${e2eProblems.join("\n- ")}\n` +
      "The specs create agency, maid and enquiry rows; production data must never be touched.",
  );

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
