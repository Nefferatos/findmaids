/**
 * Absolute base URL of this deployment.
 *
 * `NEXTAUTH_URL` / `NEXT_PUBLIC_SITE_URL` are plain strings, so an unset CI
 * variable or a Worker var left empty becomes `""`. `??` only falls back for
 * null/undefined, and `new URL(path, "")` throws `ERR_INVALID_URL` — which used
 * to break registration, password resets and emailed links on such a deploy.
 * Every candidate is therefore trimmed and validated, with localhost as the
 * last resort for local builds and tests.
 */
export function siteBaseUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  for (const candidate of [
    env.NEXT_PUBLIC_SITE_URL,
    env.NEXTAUTH_URL,
    env.AUTH_URL,
  ]) {
    const value = candidate?.trim();
    if (!value) continue;
    try {
      return new URL(value).toString().replace(/\/+$/, "");
    } catch {
      // Malformed value: keep looking at the next candidate.
    }
  }
  return "http://localhost:3000";
}

/** Absolute URL for a path on this deployment. */
export function siteUrl(
  path: string,
  env: Record<string, string | undefined> = process.env,
): string {
  return new URL(path, `${siteBaseUrl(env)}/`).toString();
}
