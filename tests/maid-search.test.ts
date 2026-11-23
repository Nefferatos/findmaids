import { describe, expect, it } from "vitest";
import {
  buildMaidSearchWhere,
  maidActiveFilterCount,
  maidFilterChips,
  maidSearchHref,
  maidSearchQueryString,
  parseMaidSearchParams,
} from "@/lib/maid-search";

const now = new Date("2026-11-20T12:00:00.000Z");

function build(params: Record<string, string | string[]>) {
  return buildMaidSearchWhere(parseMaidSearchParams(params), now);
}

/** OR groups added by the filter builder (the first AND entries are visibility). */
function orGroups(where: ReturnType<typeof buildMaidSearchWhere>) {
  const and = (where.AND ?? []) as Record<string, unknown>[];
  return and.filter((entry) => Array.isArray(entry.OR));
}

describe("advanced maid search query parsing", () => {
  it("reads repeated and comma separated values", () => {
    const filters = parseMaidSearchParams({
      nationality: ["Filipino,Indian", "Myanmese"],
      q: "  Siti  ",
      type: "transfer",
      offdays: "1",
      salary: ["550-650", "750-plus"],
      specialCare: "Bedridden",
      tags: ["Transfer", "Unknown tag"],
    });
    expect(filters.groups.nationality).toEqual([
      "Filipino",
      "Indian",
      "Myanmar",
    ]);
    expect(filters.q).toBe("Siti");
    expect(filters.helperTypes).toEqual(["transfer"]);
    expect(filters.worksOffDays).toBe(true);
    expect(filters.hasChildren).toBe(false);
    expect(filters.salary).toEqual(["550-650", "750-plus"]);
    expect(filters.specialCare).toEqual(["Bedridden"]);
    expect(filters.tags).toEqual(["Transfer"]);
  });

  it("ignores options that are not part of a group", () => {
    const filters = parseMaidSearchParams({
      nationality: ["Martian"],
      religion: ["Jedi"],
    });
    expect(filters.groups.nationality).toEqual([]);
    expect(filters.groups.religion).toEqual([]);
  });

  it("round-trips through the shareable query string", () => {
    const filters = parseMaidSearchParams({
      nationality: ["Filipino", "Indian"],
      language: "English",
      salary: "650-750",
      tags: "Transfer",
      offdays: "1",
    });
    const query = new URLSearchParams(maidSearchQueryString(filters));
    expect(query.getAll("nationality")).toEqual(["Filipino", "Indian"]);
    expect(query.get("language")).toBe("English");
    expect(query.get("salary")).toBe("650-750");
    expect(query.get("tags")).toBe("Transfer");
    expect(query.get("offdays")).toBe("1");
    expect(query.get("type")).toBeNull();
  });
});

describe("advanced maid search where clause", () => {
  it("only applies the public visibility rules when nothing is selected", () => {
    const where = build({});
    expect(where.AND).toHaveLength(2);
    expect(orGroups(where)).toHaveLength(0);
  });

  it("uses OR inside one group and AND between groups", () => {
    const where = build({
      nationality: ["Filipino", "Indian"],
      language: "Tamil",
    });
    const groups = orGroups(where);
    expect(groups).toHaveLength(2);
    expect(groups[0].OR).toHaveLength(2);
    expect(groups[1].OR).toEqual([{ languages: { hasSome: ["Tamil"] } }]);
  });

  it("matches salary against expected salary with non-overlapping bands", () => {
    const where = build({ salary: "650-750" });
    const groups = orGroups(where);
    expect(groups[0].OR).toEqual([
      {
        OR: [
          { expectedSalary: { gte: 650, lte: 749 } },
          {
            AND: [
              { expectedSalary: null },
              { monthlySalary: { gte: 650, lte: 749 } },
            ],
          },
        ],
      },
    ]);
  });

  it("ORs the selected helper types inside one group", () => {
    const where = build({ type: ["transfer", "ex-singapore"] });
    const groups = orGroups(where);
    expect(groups).toHaveLength(1);
    expect(groups[0].OR).toHaveLength(2);
    expect(JSON.stringify(groups[0])).toContain("transfer");
    expect(JSON.stringify(groups[0])).toContain("ex-singapore");
  });

  it("treats 'Others' nationality as everything outside the known list", () => {
    const where = build({ nationality: "Others" });
    const groups = orGroups(where);
    const condition = groups[0].OR as Record<string, unknown>[];
    expect(condition[0]).toHaveProperty("NOT");
  });

  it("searches special care and agency tags against existing profile data", () => {
    const care = build({ specialCare: "Bedridden" });
    expect(JSON.stringify(care)).toContain("bedridden");

    const tags = build({ tags: "Care for pets" });
    expect(JSON.stringify(tags)).toContain("Able to care for dog/cat?");
  });

  it("applies the created-within, children and video filters", () => {
    const where = build({ within: "7", children: "1", video: "1" });
    const and = where.AND as Record<string, unknown>[];
    expect(and).toContainEqual({ childrenCount: { gt: 0 } });
    expect(and).toContainEqual({ videoUrl: { not: null } });
    const created = and.find((entry) => entry.createdAt) as {
      createdAt: { gte: Date };
    };
    expect(created.createdAt.gte.toISOString()).toBe(
      "2026-11-13T12:00:00.000Z",
    );
  });
});

describe("maid search URL helpers", () => {
  it("keeps legacy bookmarked values working", () => {
    const filters = parseMaidSearchParams({
      nationality: "Myanmese",
      duty: "Care for Elderly/Disabled",
      type: "ex-singapore-maid",
    });
    expect(filters.groups.nationality).toEqual(["Myanmar"]);
    expect(filters.groups.duty).toEqual(["Elderly"]);
    expect(filters.helperTypes).toEqual(["ex-singapore"]);
  });

  it("parses and serializes multi-select helper types and sort", () => {
    const filters = parseMaidSearchParams({
      type: ["transfer", "home-country"],
      sort: "reference",
    });
    expect(filters.helperTypes).toEqual(["transfer", "home-country"]);
    expect(filters.sort).toBe("reference");
    const query = new URLSearchParams(maidSearchQueryString(filters));
    expect(query.getAll("type")).toEqual(["transfer", "home-country"]);
    expect(query.get("sort")).toBe("reference");
  });

  it("ignores an unknown sort value", () => {
    const filters = parseMaidSearchParams({ sort: "most-expensive" });
    expect(filters.sort).toBe("newest");
  });

  it("builds links on the combined search page", () => {
    const filters = parseMaidSearchParams({ nationality: "Filipino" });
    expect(maidSearchHref(filters)).toBe("/maids/search?nationality=Filipino");
    expect(maidSearchHref(filters, 3)).toBe(
      "/maids/search?nationality=Filipino&page=3",
    );
  });

  it("builds chips that remove one filter at a time", () => {
    const filters = parseMaidSearchParams({
      nationality: ["Filipino", "Myanmar"],
      salary: "650-750",
      offdays: "1",
      type: "transfer",
    });
    const chips = maidFilterChips(filters);
    expect(chips.map((chip) => chip.label)).toEqual([
      "Works on off-days",
      "Helper type: Transfer Maid",
      "Salary: $650 - $749",
      "Nationality: Filipino",
      "Nationality: Myanmar",
    ]);
    const filipino = chips.find(
      (chip) => chip.label === "Nationality: Filipino",
    );
    expect(filipino?.href).not.toContain("Filipino");
    expect(filipino?.href).toContain("Myanmar");
    expect(maidActiveFilterCount(filters)).toBe(5);
  });
});
