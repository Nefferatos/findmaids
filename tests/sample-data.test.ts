import { describe, expect, it } from "vitest";
import {
  SAMPLE_AGENCY_MARKER,
  isLiveDeployment,
  sampleAgencyVisibilityWhere,
  sampleDataEnabled,
  sampleMaidVisibilityWhere,
} from "@/lib/sample-data";

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
    expect(sampleDataEnabled({ NODE_ENV: "production", SHOW_SAMPLE_DATA: "false" })).toBe(
      false,
    );
  });

  it("allows an explicit demo opt-in for a non-live deployment", () => {
    expect(sampleDataEnabled({ NODE_ENV: "production", SHOW_SAMPLE_DATA: "true" })).toBe(
      true,
    );
    expect(
      sampleDataEnabled({ NODE_ENV: "production", APP_ENV: "staging", SHOW_SAMPLE_DATA: "true" }),
    ).toBe(true);
  });

  it("can be switched off locally", () => {
    expect(
      sampleDataEnabled({ NODE_ENV: "development", SHOW_SAMPLE_DATA: "false" }),
    ).toBe(false);
  });

  it("hides sample agencies while keeping rows without an admin note", () => {
    expect(sampleAgencyVisibilityWhere({ NODE_ENV: "development" })).toBeNull();
    expect(sampleAgencyVisibilityWhere({ NODE_ENV: "production" })).toEqual({
      OR: [{ adminNote: null }, { adminNote: { not: SAMPLE_AGENCY_MARKER } }],
    });
    expect(
      sampleAgencyVisibilityWhere({ APP_ENV: "production", SHOW_SAMPLE_DATA: "true" }),
    ).not.toBeNull();
  });

  it("hides sample maid rows outside development", () => {
    expect(sampleMaidVisibilityWhere({ NODE_ENV: "development" })).toBeNull();
    expect(sampleMaidVisibilityWhere({ NODE_ENV: "production" })).toEqual({
      isSample: false,
    });
  });
});

