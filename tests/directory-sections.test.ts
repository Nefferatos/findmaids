import { describe, expect, it } from "vitest";
import {
  DIRECTORY_NATIONALITIES,
  buildAgencyWhere,
  directoryNationalities,
  groupAgenciesByNationality,
  parseDirectoryFilters,
} from "@/lib/directory";

const listing = (id: string, nationalitiesServed: string[]) => ({
  id,
  nationalitiesServed,
});

describe("nationality grouped maid listings", () => {
  it("places an agency under every nationality it declares", () => {
    const sections = groupAgenciesByNationality([
      listing("a", ["Filipino", "Indonesian"]),
      listing("b", ["Myanmar"]),
    ]);
    const filipino = sections.find((s) => s.nationality === "Filipino");
    const indonesian = sections.find((s) => s.nationality === "Indonesian");
    expect(filipino?.agencies.map((agency) => agency.id)).toEqual(["a"]);
    expect(indonesian?.agencies.map((agency) => agency.id)).toEqual(["a"]);
    expect(sections.some((s) => s.nationality === "Sri Lankan")).toBe(false);
  });

  it("caps each section at five cards but reports the full total", () => {
    const agencies = Array.from({ length: 8 }, (_, index) =>
      listing(`f-${index}`, ["Filipino"]),
    );
    const [filipino] = groupAgenciesByNationality(agencies);
    expect(filipino.agencies).toHaveLength(5);
    expect(filipino.total).toBe(8);
    expect(filipino.moreHref).toBe("/agencies?nationality=Filipino");
  });

  it("collects nationalities outside the standard list under Other", () => {
    const sections = groupAgenciesByNationality([
      listing("a", ["Filipino"]),
      listing("b", ["Thai"]),
    ]);
    const other = sections.find(
      (section) => section.nationality === "Other nationalities",
    );
    expect(other?.agencies.map((agency) => agency.id)).toEqual(["b"]);
    expect(other?.moreHref).toBe("/agencies");
  });

  it("keeps the standard nationality order and appends new values", () => {
    const nationalities = directoryNationalities([
      { nationalitiesServed: ["Thai", "Filipino"] },
    ]);
    expect(nationalities.slice(0, DIRECTORY_NATIONALITIES.length)).toEqual([
      ...DIRECTORY_NATIONALITIES,
    ]);
    expect(nationalities).toContain("Thai");
  });
});

describe("directory keyword search", () => {
  it("matches agency name, description and listed services", () => {
    const filters = parseDirectoryFilters({ q: "newborn care" });
    expect(filters.keyword).toBe("newborn care");
    expect(buildAgencyWhere(filters)).toMatchObject({
      status: "APPROVED",
      AND: [
        {
          OR: [
            { name: { contains: "newborn care", mode: "insensitive" } },
            { description: { contains: "newborn care", mode: "insensitive" } },
            { services: { has: "newborn care" } },
          ],
        },
      ],
    });
  });

  it("trims and bounds the keyword while keeping location filters", () => {
    const filters = parseDirectoryFilters({
      q: `  ${"a".repeat(120)}  `,
      city: "Bukit Timah",
    });
    expect(filters.keyword).toHaveLength(80);
    expect(filters.city).toBe("Bukit Timah");
    const where = buildAgencyWhere(filters);
    expect(where.OR).toEqual([
      { city: { contains: "Bukit Timah", mode: "insensitive" } },
      { province: { contains: "Bukit Timah", mode: "insensitive" } },
      { serviceLocations: { has: "Bukit Timah" } },
    ]);
    expect(where.AND).toHaveLength(1);
  });

  it("omits keyword clauses when the box is empty", () => {
    const where = buildAgencyWhere(parseDirectoryFilters({ q: "   " }));
    expect(where.AND).toBeUndefined();
  });
});
