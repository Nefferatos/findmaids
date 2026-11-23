import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { "@": root } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Unit tests must not inherit deployment markers from the shell or CI: the
    // deploy workflow runs with APP_ENV/NODE_ENV=production, which switches on
    // the live sample-data filter and hides the fixture rows these tests build.
    // Tests that need live behaviour set the markers explicitly on their own
    // env object (see tests/sample-data.test.ts).
    env: {
      APP_ENV: "test",
      NODE_ENV: "test",
      SHOW_SAMPLE_DATA: "true",
      // A developer shell or `.env` may export the local admin MFA bypass; the
      // policy tests must always run against the default (MFA required).
      ADMIN_MFA_BYPASS: "false",
    },
  },
});
