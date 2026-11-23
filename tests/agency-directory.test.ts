import { describe, expect, it } from "vitest";
import {
  AGENCY_AREAS,
  agencyHasNationality,
  agencyMatchesQuery,
  buildAgencySearchText,
  distanceFromArea,
  extractPostalCode,
  filterAgencies,
  formatDistance,
  formatMaidCounts,
  haversineKm,
  normaliseNationality,
  parseAreaValue,
  sortAgenciesByDistance,
  sortAgenciesByName,
  type DirectoryAgency,
} from "@/lib/agency-directory";

function agency(
  name: string,
  overrides: Partial<DirectoryAgency> = {},
): DirectoryAgency {
  const base: DirectoryAgency = {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    licenseNumber: "2503114",
    logoUrl: null,
    address: "1 Jalan Besar, Singapore 208783",
    city: "Singapore",
    province: "Central Region",
    postalCode: "208783",
    contactPerson: "Alex Tan",
    phone: "+65 6123 4567",
    latitude: null,
    longitude: null,
    paid: false,
    featured: false,
    bannerUrl: null,
    bannerLeftUrl: null,
    bannerRightUrl: null,
    nationalitiesServed: ["Filipino"],
    services: ["Full-time placement"],
    languages: ["English"],
    maidCounts: [],
    searchText: "",
  };
  const merged = { ...base, ...overrides };
  return { ...merged, searchText: buildAgencySearchText(merged) };
}

describe("agency directory helpers", () => {
  it("formats maid counts largest first and skips empty rows", () => {
    expect(
      formatMaidCounts([
        { nationality: "Filipino", count: 5 },
        { nationality: "Indian", count: 25 },
        { nationality: "Myanmar", count: 4 },
        { nationality: "Indonesian", count: 13 },
        { nationality: "Other", count: 0 },
      ]),
    ).toBe("25 Indian · 13 Indonesian · 5 Filipino · 4 Myanmar");
    expect(formatMaidCounts([])).toBe("");
  });

  it("normalises legacy nationality labels before counting", () => {
    expect(normaliseNationality("Indian maid")).toBe("Indian");
    expect(normaliseNationality("Myanmar Helper")).toBe("Myanmar");
    expect(normaliseNationality("filipina")).toBe("Filipino");
    expect(
      formatMaidCounts([
        { nationality: "Indian maid", count: 4 },
        { nationality: "Indian", count: 1 },
        { nationality: "Myanmar Maid", count: 2 },
        { nationality: "Filipino", count: 3 },
      ]),
    ).toBe("5 Indian · 3 Filipino · 2 Myanmar");
  });

  it("reads the six-digit postal code from a Singapore address", () => {
    expect(extractPostalCode("1 Jalan Besar, Singapore 208783")).toBe("208783");
    expect(extractPostalCode("Blk 213 Ang Mo Kio Ave 3 #01-02 560213")).toBe(
      "560213",
    );
    expect(extractPostalCode("1 Demo Road")).toBeNull();
  });

  it("builds a lower-cased search index from every searchable field", () => {
    const text = buildAgencySearchText({
      name: "Casa Care",
      address: "1 Jalan Besar, Singapore 208783",
      postalCode: "208783",
      licenseNumber: "2503114",
      contactPerson: "Alex Tan",
      phone: "+65 6123 4567",
      nationalitiesServed: ["Filipino"],
      services: ["Full-time placement"],
      languages: ["English"],
    });
    expect(text).toContain("casa care");
    expect(text).toContain("208783");
    expect(text).toContain("2503114");
    expect(text).toContain("alex tan");
    expect(text).toContain("filipino");
    expect(text).toContain("full-time placement");
    expect(text).toContain("english");
  });

  it("matches partial, case-insensitive text and multiple words", () => {
    const entry = agency("Casa Care", {
      contactPerson: "Alex Tan",
      postalCode: "208783",
    });
    expect(agencyMatchesQuery(entry, "casa")).toBe(true);
    expect(agencyMatchesQuery(entry, "ALEX")).toBe(true);
    expect(agencyMatchesQuery(entry, "208783")).toBe(true);
    expect(agencyMatchesQuery(entry, "casa alex")).toBe(true);
    expect(agencyMatchesQuery(entry, "casa bright")).toBe(false);
    expect(agencyMatchesQuery(entry, "   ")).toBe(true);
  });

  it("filters by nationality using published maid counts only", () => {
    const entry = agency("Casa Care", {
      maidCounts: [{ nationality: "Filipino", count: 2 }],
      nationalitiesServed: ["Filipino", "Myanmar"],
    });
    expect(agencyHasNationality(entry, "Filipino")).toBe(true);
    expect(agencyHasNationality(entry, "Myanmar")).toBe(false);
    expect(agencyHasNationality(entry, "")).toBe(true);
  });

  it("combines the text search and nationality filters", () => {
    const results = filterAgencies(
      [
        agency("Casa Care", {
          maidCounts: [{ nationality: "Filipino", count: 2 }],
        }),
        agency("Bright Home", {
          maidCounts: [{ nationality: "Indonesian", count: 3 }],
        }),
        agency("Casa Bright", {
          maidCounts: [{ nationality: "Indonesian", count: 1 }],
        }),
      ],
      { query: "casa", nationality: "Indonesian" },
    );
    expect(results.map((entry) => entry.name)).toEqual(["Casa Bright"]);
  });

  it("filters by the placement types and languages an agency lists", () => {
    const fullTime = agency("Casa Care", {
      services: ["Full-time placement"],
      languages: ["English"],
    });
    const partTime = agency("Bright Home", {
      services: ["Part-time placement"],
      languages: ["Mandarin"],
    });
    expect(
      filterAgencies([fullTime, partTime], {
        service: "Part-time placement",
      }).map((entry) => entry.name),
    ).toEqual(["Bright Home"]);
    expect(
      filterAgencies([fullTime, partTime], { language: "english" }).map(
        (entry) => entry.name,
      ),
    ).toEqual(["Casa Care"]);
    expect(
      filterAgencies([fullTime, partTime], {
        service: "Full-time placement",
        language: "Mandarin",
      }),
    ).toEqual([]);
  });

  it("sorts alphabetically with numbers first and punctuation ignored", () => {
    const ordered = sortAgenciesByName([
      agency("Zeta Helpers"),
      agency("24 Hour Care"),
      agency("Alpha Maids"),
      agency("(Best) Helpers"),
    ]);
    expect(ordered.map((entry) => entry.name)).toEqual([
      "24 Hour Care",
      "Alpha Maids",
      "(Best) Helpers",
      "Zeta Helpers",
    ]);
  });

  it("parses area option values and rejects bad input", () => {
    expect(parseAreaValue("1.3691,103.8454")).toEqual({
      latitude: 1.3691,
      longitude: 103.8454,
    });
    expect(parseAreaValue("")).toBeNull();
    expect(parseAreaValue("north,103.8")).toBeNull();
    expect(parseAreaValue("1,2,3")).toEqual({ latitude: 1, longitude: 2 });
  });

  it("measures roughly the right distance between two Singapore points", () => {
    const km = haversineKm(1.3691, 103.8454, 1.3048, 103.8318);
    expect(km).toBeGreaterThan(6);
    expect(km).toBeLessThan(9);
  });

  it("sorts by distance and keeps agencies without coordinates last", () => {
    const near = agency("Near Agency", {
      latitude: 1.3692,
      longitude: 103.8455,
    });
    const far = agency("Far Agency", {
      latitude: 1.4382,
      longitude: 103.789,
    });
    const unmapped = agency("Unmapped Agency");
    const area = parseAreaValue("1.3691,103.8454");
    const ordered = sortAgenciesByDistance([far, unmapped, near], area);
    expect(ordered.map((entry) => entry.name)).toEqual([
      "Near Agency",
      "Far Agency",
      "Unmapped Agency",
    ]);
    expect(distanceFromArea(unmapped, area)).toBeNull();
  });

  it("labels distances in metres and kilometres", () => {
    expect(formatDistance(0.42)).toBe("420 m");
    expect(formatDistance(3.24)).toBe("3.2 km");
  });

  it("every area option carries a usable latitude,longitude value", () => {
    for (const entry of AGENCY_AREAS) {
      const point = parseAreaValue(`${entry.latitude},${entry.longitude}`);
      expect(point).not.toBeNull();
      expect(point?.latitude).toBeCloseTo(entry.latitude);
    }
  });
});
