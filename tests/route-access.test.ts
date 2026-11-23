import { describe, expect, it } from "vitest";
import {
  isCookieMutationPath,
  isProtectedPath,
} from "../lib/security/route-access";

/**
 * Regression cover for a production bug: `/api/privacy/consent` was treated as
 * login-required, so the cookie banner's POST was redirected to /login and died
 * as "Failed to fetch" for every anonymous visitor.
 */
describe("route access classification", () => {
  it("lets anonymous visitors write cookie consent but keeps the same-origin check", () => {
    expect(isProtectedPath("/api/privacy/consent")).toBe(false);
    expect(isCookieMutationPath("/api/privacy/consent")).toBe(true);
  });

  it("still requires a session for admin, agency and data-deletion routes", () => {
    for (const path of [
      "/admin",
      "/admin/approvals",
      "/agency",
      "/api/agency/maids",
      "/api/agency/maids/abc123",
      "/api/admin/users",
      "/api/data-deletion",
    ]) {
      expect(isProtectedPath(path)).toBe(true);
      expect(isCookieMutationPath(path)).toBe(true);
    }
  });

  it("leaves public pages and APIs open", () => {
    for (const path of [
      "/",
      "/agencies/demo-agency-sg",
      "/login",
      "/api/health",
      "/api/public/agencies",
      "/api/auth/csrf",
    ]) {
      expect(isProtectedPath(path)).toBe(false);
      expect(isCookieMutationPath(path)).toBe(false);
    }
  });
});
