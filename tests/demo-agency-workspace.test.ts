import { describe, expect, it } from "vitest";
import {
  demoAgencies,
  demoAgencyLeads,
  demoAgencyNames,
  demoAgencyOverview,
  demoAgencyReviews,
  demoAgencyRoster,
  demoRosterNationalities,
  filterDemoAgencyRoster,
} from "@/lib/demo-listings";

describe("sample agency workspace data", () => {
  it("keeps every fictional roster record unique and tied to a demo agency", () => {
    const references = demoAgencyRoster.map((maid) => maid.reference);
    expect(new Set(references).size).toBe(references.length);
    const names = new Set(demoAgencyNames());
    expect(demoAgencyRoster.every((maid) => names.has(maid.agency))).toBe(true);
    expect(demoAgencyNames()).toEqual(demoAgencies.map((agency) => agency.name));
  });

  it("describes each roster record with the fields the sample dashboard shows", () => {
    for (const maid of demoAgencyRoster) {
      expect(maid.nationality.length).toBeGreaterThan(0);
      expect(maid.languages.length).toBeGreaterThan(0);
      expect(maid.duties.length).toBeGreaterThan(0);
      expect(maid.experienceYears).toBeGreaterThanOrEqual(0);
      expect(["Available", "On hold", "Placed"]).toContain(maid.status);
    }
  });

  it("filters by agency, nationality and status", () => {
    const agency = demoAgencyNames()[0];
    const scoped = filterDemoAgencyRoster({ agency });
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.every((maid) => maid.agency === agency)).toBe(true);

    const filipino = filterDemoAgencyRoster({
      agency,
      nationality: "filipino",
    });
    expect(filipino.length).toBeGreaterThan(0);
    expect(filipino.every((maid) => maid.nationality === "Filipino")).toBe(true);

    const available = filterDemoAgencyRoster({ status: "available" });
    expect(available.length).toBeGreaterThan(0);
    expect(available.every((maid) => maid.status === "Available")).toBe(true);

    expect(
      filterDemoAgencyRoster({ agency, nationality: "Thai" }),
    ).toHaveLength(0);
  });

  it("ignores unknown filter values instead of hiding everything", () => {
    expect(filterDemoAgencyRoster({ agency: "Nonexistent Agency" })).toHaveLength(
      0,
    );
    expect(filterDemoAgencyRoster({})).toHaveLength(demoAgencyRoster.length);
  });

  it("lists the nationalities available to the agency filter", () => {
    const agency = demoAgencyNames()[0];
    const scoped = demoRosterNationalities(agency);
    expect(scoped.length).toBeGreaterThan(1);
    expect(scoped).toEqual([...scoped].sort((a, b) => a.localeCompare(b)));
    expect(demoRosterNationalities().length).toBeGreaterThanOrEqual(
      scoped.length,
    );
  });

  it("provides the sample workspace panels with fictional data only", () => {
    expect(demoAgencyOverview.planName.length).toBeGreaterThan(0);
    expect(demoAgencyOverview.enquiriesThisMonth).toBeLessThanOrEqual(
      demoAgencyOverview.leadAllowance,
    );
    expect(demoAgencyLeads.length).toBeGreaterThan(0);
    expect(demoAgencyReviews.length).toBeGreaterThan(0);
    expect(
      demoAgencyLeads.every((lead) => lead.name.startsWith("Sample household")),
    ).toBe(true);
    expect(
      demoAgencyReviews.every((review) => review.author.startsWith("Sample")),
    ).toBe(true);
  });
});
