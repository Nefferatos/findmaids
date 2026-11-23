type Env = Record<string, string | undefined>;

const PLACEHOLDER_MARKERS = ["replace-with", "changeme", "your-secret"];

/**
 * Fails closed in production when session signing or TOTP encryption would use a
 * placeholder. A Worker built from a filled-in `.env` bakes those values into the
 * bundle, so this guard is what stops a public placeholder from signing real
 * session cookies.
 */
export function findUnsafeProductionSecrets(env: Env = process.env): string[] {
  if (env.NODE_ENV !== "production") return [];
  const problems: string[] = [];

  const sessionSecret = env.AUTH_SECRET?.trim() || env.NEXTAUTH_SECRET?.trim();
  if (!sessionSecret) {
    problems.push("AUTH_SECRET is not set.");
  } else if (
    sessionSecret.length < 32 ||
    PLACEHOLDER_MARKERS.some((marker) =>
      sessionSecret.toLowerCase().includes(marker),
    )
  ) {
    problems.push(
      "AUTH_SECRET is a documented placeholder or shorter than 32 characters.",
    );
  }
  if (
    env.AUTH_SECRET &&
    env.NEXTAUTH_SECRET &&
    env.AUTH_SECRET !== env.NEXTAUTH_SECRET
  ) {
    problems.push("AUTH_SECRET and NEXTAUTH_SECRET differ.");
  }

  const totpKey = env.TOTP_ENCRYPTION_KEY?.trim();
  if (totpKey) {
    const padding = /={1,2}$/.exec(totpKey)?.[0].length ?? 0;
    const bytes = Math.floor((totpKey.length * 3) / 4) - padding;
    if (bytes !== 32) {
      problems.push("TOTP_ENCRYPTION_KEY must decode to exactly 32 bytes.");
    }
  }
  if (env.ADMIN_MFA_BYPASS?.trim().toLowerCase() === "true") {
    problems.push("ADMIN_MFA_BYPASS must never be enabled in production.");
  }
  return problems;
}

export function assertProductionSecrets(env: Env = process.env) {
  const problems = findUnsafeProductionSecrets(env);
  if (problems.length)
    throw new Error(
      `Refusing to start with unsafe production configuration:\n- ${problems.join("\n- ")}`,
    );
}
