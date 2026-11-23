import { describe, expect, it } from "vitest";
import {
  MAID_DIRECTORY_PAGE_SIZE,
  maidDirectoryHref,
  maidDirectoryPage,
  maidDirectoryWhere,
  parseMaidDirectoryParams,
} from "@/lib/maid-directory";

describe("parseMaidDirectoryParams", () => {
  it("defaults to the hidden view on page 1", () => {
    expect(parseMaidDirectoryParams({})).toEqual({
      q: "",
      status: "hidden",
      page: 1,
    });
  });

  it("reads q, status and page", () => {
    expect(
      parseMaidDirectoryParams({
        q: "  rinzin ",
        status: "published",
        page: "3",
      }),
    ).toEqual({ q: "rinzin", status: "published", page: 3 });
    expect(parseMaidDirectoryParams({ status: "all" }).status).toBe("all");
  });

  it("ignores an unknown status, a broken page and repeated params", () => {
    expect(parseMaidDirectoryParams({ status: "archived" }).status).toBe(
      "hidden",
    );
    expect(parseMaidDirectoryParams({ page: "0" }).page).toBe(1);
    expect(parseMaidDirectoryParams({ page: "abc" }).page).toBe(1);
    expect(parseMaidDirectoryParams({ page: ["4", "9"] }).page).toBe(4);
  });

  it("caps the search term", () => {
    expect(parseMaidDirectoryParams({ q: "x".repeat(200) }).q).toHaveLength(80);
  });
});

describe("maidDirectoryWhere", () => {
  it("always scopes the query to the agency", () => {
    for (const status of ["hidden", "published", "all"] as const) {
      expect(maidDirectoryWhere("agency-1", { q: "", status }).agencyId).toBe(
        "agency-1",
      );
    }
  });

  it("filters by published state", () => {
    expect(maidDirectoryWhere("a", { q: "", status: "hidden" }).published).toBe(
      false,
    );
    expect(
      maidDirectoryWhere("a", { q: "", status: "published" }).published,
    ).toBe(true);
    expect(
      maidDirectoryWhere("a", { q: "", status: "all" }).published,
    ).toBeUndefined();
  });

  it("searches the reference code and the name, case-insensitively", () => {
    const where = maidDirectoryWhere("a", { q: "INA-JEN", status: "all" });
    expect(where.OR).toEqual([
      { reference: { contains: "INA-JEN", mode: "insensitive" } },
      { fullName: { contains: "INA-JEN", mode: "insensitive" } },
    ]);
  });

  it("adds no OR filter for an empty search", () => {
    expect(
      maidDirectoryWhere("a", { q: "", status: "all" }).OR,
    ).toBeUndefined();
  });
});

describe("maidDirectoryPage", () => {
  it("paginates 174 profiles well past the first 60", () => {
    const pages = Math.ceil(174 / MAID_DIRECTORY_PAGE_SIZE);
    expect(pages).toBe(9);
    expect(maidDirectoryPage(174, 1)).toMatchObject({ from: 1, to: 20, pages });
    // Page 4 starts at profile 61: nothing is capped at 60.
    expect(maidDirectoryPage(174, 4)).toMatchObject({
      page: 4,
      skip: 60,
      from: 61,
      to: 80,
    });
    expect(maidDirectoryPage(174, 9)).toMatchObject({ from: 161, to: 174 });
  });

  it("clamps a page beyond the last one", () => {
    expect(maidDirectoryPage(45, 99).page).toBe(3);
    expect(maidDirectoryPage(45, 99).from).toBe(41);
  });

  it("handles an empty result", () => {
    expect(maidDirectoryPage(0, 3)).toMatchObject({
      page: 1,
      pages: 1,
      from: 0,
      to: 0,
    });
  });
});

describe("maidDirectoryHref", () => {
  it("keeps the URL clean for the default view", () => {
    expect(maidDirectoryHref({})).toBe("/agency/maids");
    expect(maidDirectoryHref({ status: "hidden", page: 1 })).toBe(
      "/agency/maids",
    );
  });

  it("keeps the search term and status when paging", () => {
    expect(maidDirectoryHref({ q: "ina", status: "published", page: 2 })).toBe(
      "/agency/maids?q=ina&status=published&page=2",
    );
  });
});
