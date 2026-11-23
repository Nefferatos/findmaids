import { describe, expect, it } from "vitest";
import {
  maidTag,
  orderAgencyBanners,
  postedLabel,
  type HomeAgencyBanner,
} from "@/lib/home";

const now = new Date("2026-11-20T12:00:00.000Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);

function banner(
  id: string,
  featured: boolean,
  createdAt: Date,
): HomeAgencyBanner {
  return {
    id,
    name: `Agency ${id}`,
    slug: `agency-${id}`,
    city: "Singapore",
    province: "Singapore",
    bannerUrl: `https://example.test/${id}.png`,
    featured,
    createdAt,
  };
}

describe("home maid card labels", () => {
  it("labels a profile posted in the last day as Today", () => {
    expect(postedLabel(new Date(now.getTime() - 3_600_000), now)).toBe("Today");
  });

  it("uses Yesterday and day counts for recent profiles", () => {
    expect(postedLabel(daysAgo(1), now)).toBe("Yesterday");
    expect(postedLabel(daysAgo(2), now)).toBe("2 days ago");
  });

  it("falls back to a short date for older profiles", () => {
    expect(postedLabel(daysAgo(45), now)).toBe("6 Oct");
  });

  it("prefers Featured, then New inside the two-week window", () => {
    expect(maidTag(daysAgo(90), true, now)).toBe("Featured");
    expect(maidTag(daysAgo(1), false, now)).toBe("New");
    expect(maidTag(daysAgo(13), false, now)).toBe("New");
  });

  it("shows no tag once a profile is older than the new window", () => {
    expect(maidTag(daysAgo(20), false, now)).toBeNull();
  });
});

describe("homepage agency banner order", () => {
  it("puts featured placements first, then the newest agencies", () => {
    const ordered = orderAgencyBanners([
      banner("old", false, daysAgo(30)),
      banner("new", false, daysAgo(2)),
      banner("featured-old", true, daysAgo(20)),
      banner("featured-new", true, daysAgo(10)),
    ]);
    expect(ordered.map((entry) => entry.id)).toEqual([
      "featured-new",
      "featured-old",
      "new",
      "old",
    ]);
  });

  it("does not mutate the input list", () => {
    const input = [
      banner("a", false, daysAgo(5)),
      banner("b", true, daysAgo(5)),
    ];
    orderAgencyBanners(input);
    expect(input.map((entry) => entry.id)).toEqual(["a", "b"]);
  });
});
