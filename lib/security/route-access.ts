/**
 * Route classification used by `middleware.ts`.
 *
 * Kept in one place so a regression test can assert that cookie-consent writes
 * stay open to anonymous visitors while still requiring the same-origin check.
 */

const protectedPrefixes = ["/admin", "/agency", "/api/admin/", "/api/agency/"];

/** Mutations that carry a cookie and must pass the same-origin check. */
export const cookieMutationPaths = [
  "/api/data-deletion",
  "/api/privacy/consent",
];

/** Paths that require a signed-in user (role checks happen per route). */
export const protectedPaths = ["/api/data-deletion"];

export function isCookieMutationPath(path: string) {
  return (
    protectedPrefixes.some((prefix) => path.startsWith(prefix)) ||
    cookieMutationPaths.includes(path)
  );
}

export function isProtectedPath(path: string) {
  return (
    protectedPrefixes.some((prefix) => path.startsWith(prefix)) ||
    protectedPaths.includes(path)
  );
}
