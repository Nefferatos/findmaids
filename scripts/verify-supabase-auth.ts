/**
 * Verifies that Supabase Auth can create an email/password account **and** sign
 * it in. Creates one throwaway identity (`authcheck-…@example.test`) and always
 * deletes it again, so it never leaves users behind.
 *
 * This is the quickest way to catch a project that is not ready — most often
 * "Authentication > Providers > Email" being switched off, which GoTrue reports
 * as `email_provider_disabled` ("Email logins are disabled").
 *
 * Usage: npm run auth:verify
 */
import { loadEnvFile } from "../lib/security/staging-guard";
import {
  supabaseAuthEnabled,
  supabaseCreateUser,
  supabaseDeleteUser,
  supabasePasswordGrant,
} from "../lib/supabase-auth";

loadEnvFile(".env");

async function main() {
  if (!supabaseAuthEnabled()) {
    console.error(
      "FAIL: Supabase Auth is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing, or SUPABASE_AUTH_DISABLED=true).",
    );
    process.exitCode = 1;
    return;
  }

  const email = `authcheck-${Date.now()}@example.test`;
  const password = `Verify-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  const created = await supabaseCreateUser({
    email,
    password,
    name: "Auth verification",
    accountType: "employer",
  });
  if (!created.ok || !created.userId) {
    console.error(
      `FAIL: could not create a Supabase identity (${created.error ?? "unknown"}).`,
    );
    process.exitCode = 1;
    return;
  }

  try {
    const grant = await supabasePasswordGrant({ email, password });
    if (grant.ok) {
      console.log(
        `PASS: Supabase created identity ${created.userId} and accepted its password (${email}).`,
      );
      return;
    }
    console.error(
      `FAIL: the identity exists but sign-in failed with "${grant.error ?? "unknown"}".`,
    );
    if (grant.error === "email_provider_disabled")
      console.error(
        "      Enable Authentication > Providers > Email in the Supabase dashboard.",
      );
    if (grant.error === "email_not_confirmed")
      console.error(
        "      This app creates identities with email_confirm: true; check for a manual change in the dashboard.",
      );
    if (grant.error === "not_configured" || grant.error === "unavailable")
      console.error(
        "      The project rejected the request or was unreachable; check SUPABASE_URL, the keys and the network.",
      );
    process.exitCode = 1;
  } finally {
    const deleted = await supabaseDeleteUser(created.userId);
    console.log(
      `cleanup: throwaway identity ${created.userId} ${deleted ? "deleted" : "STILL PRESENT"}`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(
    `FAIL: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
