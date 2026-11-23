/**
 * Only same-site paths may be used as a post-login destination.
 *
 * The login form reads `?callbackUrl=` from the URL, so without this an attacker
 * could send `/login?callbackUrl=https://evil.example` and have the victim land
 * on that site immediately after a successful sign-in.
 */
const CONTROL_OR_BACKSLASH = /[\u0000-\u001f\u007f\\]/;

export function safeInternalPath(
  value: string | null | undefined,
  fallback = "/",
): string {
  if (!value) return fallback;
  const candidate = value.trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return fallback;
  if (CONTROL_OR_BACKSLASH.test(candidate)) return fallback;
  // "/javascript:..." and similar scheme-like relative paths.
  if (/^\/[^/]*:/.test(candidate)) return fallback;
  try {
    const base = "https://findmaids.invalid";
    const url = new URL(candidate, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
