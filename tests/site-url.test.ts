import { describe, expect, it } from "vitest";
import { siteBaseUrl, siteUrl } from "@/lib/site-url";

describe("site url", () => {
  it("uses the deployment origin", () => {
    expect(siteBaseUrl({ NEXT_PUBLIC_SITE_URL: "https://findmaids.sg" })).toBe(
      "https://findmaids.sg",
    );
    expect(
      siteUrl("/api/verify-email?token=abc", {
        NEXT_PUBLIC_SITE_URL: "https://findmaids.sg",
      }),
    ).toBe("https://findmaids.sg/api/verify-email?token=abc");
  });

  it("falls back through the env vars and ignores blank values", () => {
    // A CI variable that is not set arrives as an empty string; `??` would keep
    // it and `new URL(path, "")` throws ERR_INVALID_URL.
    expect(siteBaseUrl({ NEXT_PUBLIC_SITE_URL: "", NEXTAUTH_URL: "" })).toBe(
      "http://localhost:3000",
    );
    expect(
      siteBaseUrl({
        NEXT_PUBLIC_SITE_URL: "  ",
        NEXTAUTH_URL: "https://a.example",
      }),
    ).toBe("https://a.example");
    expect(
      siteBaseUrl({
        NEXT_PUBLIC_SITE_URL: "not a url",
        AUTH_URL: "https://b.example",
      }),
    ).toBe("https://b.example");
  });

  it("builds absolute links without a double slash", () => {
    expect(siteBaseUrl({ NEXT_PUBLIC_SITE_URL: "https://findmaids.sg/" })).toBe(
      "https://findmaids.sg",
    );
    expect(
      siteUrl("/reset-password?token=abc", {
        NEXT_PUBLIC_SITE_URL: "https://findmaids.sg/",
      }),
    ).toBe("https://findmaids.sg/reset-password?token=abc");
  });
});
