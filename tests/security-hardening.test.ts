import { describe, expect, it } from "vitest";
import {
  isApiBodyWithinLimit,
  isSameOriginMutation,
} from "@/lib/security/request-guards";

describe("request security guards", () => {
  it("rejects cross-origin and evidence-free cookie mutations", () => {
    expect(isSameOriginMutation({ origin: "https://attacker.example", fetchSite: "cross-site", expectedOrigin: "https://findmaids.ph", hasCookie: true })).toBe(false);
    expect(isSameOriginMutation({ origin: null, fetchSite: null, expectedOrigin: "https://findmaids.ph", hasCookie: true })).toBe(false);
    expect(isSameOriginMutation({ origin: null, fetchSite: "same-origin", expectedOrigin: "https://findmaids.ph", hasCookie: true })).toBe(true);
    expect(isSameOriginMutation({ origin: "https://findmaids.ph", fetchSite: "same-origin", expectedOrigin: "https://findmaids.ph", hasCookie: true })).toBe(true);
  });

  it("applies route-specific API body limits and rejects malformed lengths", () => {
    expect(isApiBodyWithinLimit("/api/register", "1048576")).toBe(true);
    expect(isApiBodyWithinLimit("/api/register", "1048577")).toBe(false);
    expect(isApiBodyWithinLimit("/api/agency/media", "10485760")).toBe(true);
    expect(isApiBodyWithinLimit("/api/agency/media", "10485761")).toBe(false);
    expect(isApiBodyWithinLimit("/api/enquiries", "chunked")).toBe(false);
    expect(isApiBodyWithinLimit("/api/enquiries", null)).toBe(true);
  });
});
