import { describe, expect, it } from "vitest";
import { rotateFeatured, scoreAgency } from "@/lib/ranking";
import { buildAgencyWhere, parseDirectoryFilters } from "@/lib/directory";
import { enquirySubmissionSchema } from "@/lib/validation";

describe("directory ranking and filters", () => {
  it("weights plan priority, rating, reviews, completeness, and activity", () => {
    const base = {
      id: "a",
      listingPriority: 0,
      rating: 0,
      reviewCount: 0,
      profileCompleteness: 0,
      daysSinceActivity: 90,
    };
    const improved = {
      ...base,
      listingPriority: 10,
      rating: 5,
      reviewCount: 4,
      profileCompleteness: 1,
      daysSinceActivity: 0,
    };
    expect(scoreAgency(improved)).toBeGreaterThan(scoreAgency(base));
  });

  it("rotates featured order by day without losing entries", () => {
    const agencies = [{ id: "one" }, { id: "two" }, { id: "three" }];
    const first = rotateFeatured(agencies, new Date("2026-10-20T12:00:00Z"));
    const next = rotateFeatured(agencies, new Date("2026-10-21T12:00:00Z"));
    expect(new Set(first.map((agency) => agency.id))).toEqual(
      new Set(agencies.map((agency) => agency.id)),
    );
    expect(first[0].id).not.toBe(next[0].id);
  });

  it("builds approved-only filters and safely parses shareable query parameters", () => {
    const filters = parseDirectoryFilters({
      city: " Cebu ",
      service: ["Full-time", "Placement"],
      verified: "true",
      rating: "4",
      page: "2",
    });
    expect(buildAgencyWhere(filters)).toMatchObject({
      status: "APPROVED",
      city: { contains: "Cebu", mode: "insensitive" },
      services: { hasEvery: ["Full-time", "Placement"] },
      verifiedBadge: true,
    });
    expect(filters.page).toBe(2);
    expect(parseDirectoryFilters({ page: "-9", rating: "7" })).toMatchObject({
      page: 1,
      rating: undefined,
    });
  });

  it("validates enquiry consent and normalizes privacy-sensitive values", () => {
    const valid = enquirySubmissionSchema.safeParse({
      agencyId: "agency-1",
      name: "  Jamie Cruz  ",
      email: "JAMIE@example.com",
      message: "Please contact me.",
      consentGiven: "on",
      preferredStartDate: "2027-02-01",
      budget: "25000",
      website: "",
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.name).toBe("Jamie Cruz");
      expect(valid.data.email).toBe("jamie@example.com");
      expect(valid.data.consentGiven).toBe(true);
      expect(valid.data.budget).toBe(25000);
    }
    expect(
      enquirySubmissionSchema.safeParse({
        agencyId: "agency-1",
        name: "Jamie",
        email: "bad",
        message: "Hello",
        website: "bot",
      }).success,
    ).toBe(false);
  });
});
