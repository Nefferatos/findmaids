import { describe, expect, it } from "vitest";
import { demoAgencies, demoMaidProfiles } from "@/lib/demo-listings";

describe("display-only sample listings", () => {
  it("provides exactly five fictional maid profiles", () => {
    expect(demoMaidProfiles).toHaveLength(5);
    expect(
      new Set(demoMaidProfiles.map((profile) => profile.reference)).size,
    ).toBe(5);
  });

  it("provides exactly three clearly fictional agencies", () => {
    expect(demoAgencies).toHaveLength(3);
    expect(
      demoAgencies.every((agency) => agency.name.startsWith("Example Agency")),
    ).toBe(true);
  });

  it("associates each fictional maid profile with a sample agency", () => {
    const agencyNames = new Set(demoAgencies.map((agency) => agency.name));
    expect(
      demoMaidProfiles.every((profile) => agencyNames.has(profile.agency)),
    ).toBe(true);
  });
});
