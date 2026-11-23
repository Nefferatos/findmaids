type Env = Record<string, string | undefined>;

/**
 * Local-testing escape hatch for the ADMIN TOTP gate.
 *
 * Disabled for `NODE_ENV=production`, and `lib/security/env-guard.ts` refuses to
 * start a production build if `ADMIN_MFA_BYPASS=true` is present, so the flag
 * cannot be carried into a deployment. Use it only on a development machine or
 * staging database while exercising admin screens.
 */
export function adminMfaBypassEnabled(env: Env = process.env) {
  return (
    env.NODE_ENV !== "production" &&
    env.ADMIN_MFA_BYPASS?.trim().toLowerCase() === "true"
  );
}

export function adminMfaSatisfied(
  input: {
    role: string;
    permission: string;
    totpEnabled: boolean;
    sessionVerified: boolean;
  },
  env: Env = process.env,
) {
  if (adminMfaBypassEnabled(env)) return true;
  return (
    input.role !== "ADMIN" ||
    input.permission === "twoFactor" ||
    (input.totpEnabled && input.sessionVerified)
  );
}
