import type { Instrumentation } from "next";
import { adminMfaBypassEnabled } from "./lib/security/admin-mfa";
import { assertProductionSecrets } from "./lib/security/env-guard";

export async function register() {
  // Fail closed instead of signing sessions with a placeholder secret.
  assertProductionSecrets();
  if (adminMfaBypassEnabled())
    console.warn(
      "[security] ADMIN_MFA_BYPASS=true — admin TOTP is disabled for local testing. Never enable this in production.",
    );
  if (process.env.NEXT_RUNTIME === "nodejs")
    await import("./sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");
}

export const onRequestError: Instrumentation.onRequestError = async (
  ...args
) => {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  await Sentry.captureRequestError(...args);
};
