import { describe, expect, it } from "vitest";
import {
  calculateProration,
  checkLeadLimit,
  invoiceNumber,
  transitionSubscription,
} from "@/lib/payments/domain";
import { agencyScopedWhere } from "@/lib/tenant";

describe("payment domain", () => {
  it("allows valid subscription transitions and rejects invalid ones", () => {
    expect(transitionSubscription("PENDING", "ACTIVE")).toBe("ACTIVE");
    expect(transitionSubscription("PAST_DUE", "EXPIRED")).toBe("EXPIRED");
    expect(() => transitionSubscription("EXPIRED", "PAST_DUE")).toThrow(
      "Invalid subscription transition",
    );
  });

  it("prorates only an immediate upgrade over the remaining period", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const end = new Date("2026-01-31T00:00:00Z");
    const midpoint = new Date("2026-01-16T00:00:00Z");
    expect(calculateProration(1000, 2000, start, end, midpoint)).toBe(500);
    expect(calculateProration(2000, 1000, start, end, midpoint)).toBe(0);
  });

  it("formats annual invoice sequence values with six digits", () => {
    expect(invoiceNumber(2026, 123)).toBe("FM-2026-000123");
  });

  it("checks lead limits without silently allowing overage", () => {
    expect(checkLeadLimit(10, 9)).toEqual({ allowed: true, remaining: 1 });
    expect(checkLeadLimit(10, 10)).toEqual({ allowed: false, remaining: 0 });
    expect(checkLeadLimit(null, 100)).toEqual({
      allowed: true,
      remaining: null,
    });
  });

  it("always constrains agency-owned queries to the authenticated tenant", () => {
    expect(agencyScopedWhere("agency-a", { status: "NEW" })).toEqual({
      agencyId: "agency-a",
      status: "NEW",
    });
    expect(
      agencyScopedWhere("agency-a", {
        id: "lead-from-b",
        agencyId: "agency-b",
      }),
    ).toEqual({ agencyId: "agency-a", id: "lead-from-b" });
  });
});