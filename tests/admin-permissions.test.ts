import { describe, expect, it } from "vitest";
import { adminLanding, canAccess } from "@/lib/permissions";

describe("admin permission map", () => {
  it("grants ADMIN access to each configured admin capability", () => {
    const permissions = [
      "dashboard",
      "approvals",
      "reviews",
      "leads",
      "payments",
      "subscriptions",
      "plans",
      "placements",
      "reports",
      "content",
      "users",
      "audit",
      "settings",
      "twoFactor",
    ] as const;
    for (const permission of permissions)
      expect(canAccess("ADMIN", permission)).toBe(true);
  });

  it("limits STAFF to approvals, reviews, leads, and dashboard", () => {
    for (const permission of [
      "dashboard",
      "approvals",
      "reviews",
      "leads",
    ] as const)
      expect(canAccess("STAFF", permission)).toBe(true);
    for (const permission of [
      "payments",
      "subscriptions",
      "plans",
      "placements",
      "reports",
      "content",
      "users",
      "audit",
      "settings",
      "twoFactor",
    ] as const)
      expect(canAccess("STAFF", permission)).toBe(false);
    expect(adminLanding("STAFF")).toBe("/admin/approvals");
  });

  it("denies AGENCY and VISITOR roles", () => {
    expect(canAccess("AGENCY", "approvals")).toBe(false);
    expect(canAccess("VISITOR", "dashboard")).toBe(false);
  });
});
