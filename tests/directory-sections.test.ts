import { describe, expect, it } from "vitest";
import {
  DIRECTORY_NATIONALITIES,
  buildAgencyWhere,
  directoryNationalities,
  groupAgenciesByNationality,
  parseDirectoryFilters,
} from "@/lib/directory";
import { publishedMaidWhere } from "@/lib/maids";

const listing = (id: string, nationalitiesServed: string[]) => ({
  id,
  nationalitiesServed,
});

/** Agency-level keyword clauses, in the order `buildAgencyWhere` adds them. */
const agencyKeyword = (keyword: string) => [
  { name: { contains: keyword, mode: "insensitive" } },
  { description: { contains: keyword, mode: "insensitive" } },
  { services: { has: keyword } },
];

/** Maid clause that lets a maid name or reference find her agency. */
const maidKeyword = (keyword: string) => ({
  maids: {
    some: {
      ...publishedMaidWhere(),
      OR: [
        { fullName: { contains: keyword, mode: "insensitive" } },
        { reference: { contains: keyword, mode: "insensitive" } },
      ],
    },
  },
});

/** Pulls the maid keyword clause out of the built where-clause. */
function maidClause(where: ReturnType<typeof buildAgencyWhere>) {
  const and = Array.isArray(where.AND) ? where.AND : [];
  const keyword = and[0] as unknown as { OR?: unknown[] } | undefined;
  return keyword?.OR?.[3];
}

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
  it("matches agency name, description, listed services and published maids", () => {
    const filters = parseDirectoryFilters({ q: "newborn care" });
    expect(filters.keyword).toBe("newborn care");
    expect(buildAgencyWhere(filters)).toMatchObject({
      status: "APPROVED",
      AND: [
        {
          OR: [...agencyKeyword("newborn care"), maidKeyword("newborn care")],
        },
      ],
    });
  });

  it("lets a maid's name find the agency that published her", () => {
    const where = buildAgencyWhere(parseDirectoryFilters({ q: "Priyanka" }));
    expect(maidClause(where)).toEqual(maidKeyword("Priyanka"));
    expect(maidClause(where)).toMatchObject({
      maids: { some: { published: true } },
    });
  });

  it("matches maid reference codes case-insensitively", () => {
    const where = buildAgencyWhere(
      parseDirectoryFilters({ q: "ind-dar-pri-9698" }),
    );
    expect(maidClause(where)).toEqual(maidKeyword("ind-dar-pri-9698"));
  });

  it("keeps the maid clause out when the keyword is empty", () => {
    expect(
      maidClause(buildAgencyWhere(parseDirectoryFilters({ q: " " }))),
    ).toBe(undefined);
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
