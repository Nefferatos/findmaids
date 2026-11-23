import { describe, expect, it } from "vitest";
import { matchesWhere } from "@/lib/prisma-mock";
import {
  SAMPLE_ADMIN_NOTE_PREFIXES,
  SAMPLE_AGENCY_MARKER,
  isLiveDeployment,
  sampleAgencyVisibilityWhere,
  sampleDataEnabled,
  sampleMaidVisibilityWhere,
  testAgencyExclusions,
} from "@/lib/sample-data";

/** A real agency: real name, business domain, MOM licence number. */
const realAgency = {
  name: "At The Agency",
  email: "hello@attheagency.sg",
  licenseNumber: "25C3114",
  adminNote: null as string | null,
};

/** Evaluates the live filter against one agency row. */
function visibleOnLive(agency: Record<string, unknown>): boolean {
  const where = sampleAgencyVisibilityWhere({
    NODE_ENV: "production",
  }) as unknown as Record<string, unknown> | null;
  // Columns that are absent in the fixture behave like NULL in Postgres.
  return matchesWhere(
    { licenseNumber: null, adminNote: null, ...agency },
    where ?? undefined,
  );
}

describe("sample data visibility", () => {
  it("blocks samples on any live deployment marker", () => {
    expect(isLiveDeployment({ APP_ENV: "production" })).toBe(true);
    expect(isLiveDeployment({ VERCEL_ENV: "production" })).toBe(true);
    expect(isLiveDeployment({ CF_PAGES: "production" })).toBe(true);
    expect(isLiveDeployment({ ENVIRONMENT: "production" })).toBe(true);
    expect(isLiveDeployment({ APP_ENV: "staging" })).toBe(false);

    // A live deployment never shows samples, even with the demo opt-in.
    for (const marker of [
      { APP_ENV: "production" },
      { VERCEL_ENV: "production" },
      { CF_PAGES: "production" },
      { ENVIRONMENT: "production" },
    ]) {
      expect(sampleDataEnabled({ ...marker })).toBe(false);
      expect(sampleDataEnabled({ ...marker, SHOW_SAMPLE_DATA: "true" })).toBe(
        false,
      );
    }
  });

  it("shows samples on the dev server only", () => {
    expect(sampleDataEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(sampleDataEnabled({ NODE_ENV: "test" })).toBe(true);
    // A production build (next start) with no demo flag stays clean.
    expect(sampleDataEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(
      sampleDataEnabled({ NODE_ENV: "production", SHOW_SAMPLE_DATA: "false" }),
    ).toBe(false);
  });

  it("allows an explicit demo opt-in for a non-live deployment", () => {
    expect(
      sampleDataEnabled({ NODE_ENV: "production", SHOW_SAMPLE_DATA: "true" }),
    ).toBe(true);
    expect(
      sampleDataEnabled({
        NODE_ENV: "production",
        APP_ENV: "staging",
        SHOW_SAMPLE_DATA: "true",
      }),
    ).toBe(true);
    // …but the deployed Worker sets SHOW_SAMPLE_DATA=false, which always wins.
    expect(
      sampleDataEnabled({
        NODE_ENV: "production",
        APP_ENV: "staging",
        SHOW_SAMPLE_DATA: "false",
      }),
    ).toBe(false);
  });

  it("can be switched off locally", () => {
    expect(
      sampleDataEnabled({ NODE_ENV: "development", SHOW_SAMPLE_DATA: "false" }),
    ).toBe(false);
  });

  it("keeps real agencies, including ones without a note or licence", () => {
    expect(visibleOnLive(realAgency)).toBe(true);
    expect(visibleOnLive({ ...realAgency, adminNote: null })).toBe(true);
    expect(visibleOnLive({ ...realAgency, licenseNumber: null })).toBe(true);
    expect(
      visibleOnLive({ ...realAgency, adminNote: "Call back Friday" }),
    ).toBe(true);
  });

  it("null-guards every optional column the filter reads", () => {
    // Postgres evaluates `NOT ("adminNote" LIKE 'demo:%')` to NULL for a missing
    // note, and a NULL WHERE clause drops the row - which would hide real
    // agencies. Each optional-column condition must therefore keep NULL rows.
    const conditions = testAgencyExclusions().map((condition) =>
      JSON.stringify(condition),
    );
    for (const prefix of SAMPLE_ADMIN_NOTE_PREFIXES) {
      const adminNote = conditions.find(
        (entry) =>
          entry.includes("adminNote") &&
          entry.includes(`"startsWith":"${prefix}"`),
      );
      expect(adminNote).toBeDefined();
      expect(adminNote).toContain('"adminNote":null');
    }
    const licence = conditions.find((entry) => entry.includes("licenseNumber"));
    expect(licence).toContain('"licenseNumber":null');
  });

  it("hides every sample marker an older seed could have written", () => {
    for (const adminNote of [
      SAMPLE_AGENCY_MARKER,
      "demo:homepage-banner",
      "demo:anything",
      "test:account",
    ])
      expect(visibleOnLive({ ...realAgency, adminNote })).toBe(false);
  });

  it("hides the names only a fixture uses", () => {
    for (const name of [
      "Casa Care (Demo)",
      "TEST Agency A (Basic)",
      "Demo Agency SG",
      "Demo Agency (Test Only)",
      "Sample Agency One (Demo)",
      "E2E Household Agency",
    ])
      expect(visibleOnLive({ ...realAgency, name })).toBe(false);
  });

  it("hides fixture contact details", () => {
    expect(
      visibleOnLive({ ...realAgency, email: "agency-a@example.test" }),
    ).toBe(false);
    for (const licenseNumber of [
      "TEST-A-0001",
      "E2E-TEST-001",
      "EA-2026-TEST-001",
    ])
      expect(visibleOnLive({ ...realAgency, licenseNumber })).toBe(false);
  });

  it("is not applied on localhost, so seeded rows still show in dev", () => {
    expect(sampleAgencyVisibilityWhere({ NODE_ENV: "development" })).toBeNull();
    expect(
      sampleAgencyVisibilityWhere({
        NODE_ENV: "development",
        APP_ENV: "development",
      }),
    ).toBeNull();
  });

  it("composes as an AND group that can be pushed into another AND", () => {
    const where = sampleAgencyVisibilityWhere({ APP_ENV: "production" });
    expect(where).not.toBeNull();
    expect(Array.isArray((where as { AND: unknown }).AND)).toBe(true);
    expect(testAgencyExclusions().length).toBeGreaterThanOrEqual(4);
  });

  it("hides sample maid rows outside development", () => {
    expect(sampleMaidVisibilityWhere({ NODE_ENV: "development" })).toBeNull();
    expect(sampleMaidVisibilityWhere({ NODE_ENV: "production" })).toEqual({
      isSample: false,
    });
  });
});
