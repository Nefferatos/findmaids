import { describe, expect, it } from "vitest";
import { clientIp } from "../lib/security/client-ip";
import { findUnsafeProductionSecrets } from "../lib/security/env-guard";
import { safeInternalPath } from "../lib/security/safe-redirect";

function requestWith(headers: Record<string, string>) {
  return new Request("http://localhost/api", { headers });
}

describe("client IP for rate limiting", () => {
  it("prefers cf-connecting-ip, which a browser cannot set", () => {
    expect(
      clientIp(
        requestWith({
          "cf-connecting-ip": "198.51.100.7",
          "x-forwarded-for": "10.0.0.1, 203.0.113.9",
        }),
      ),
    ).toBe("198.51.100.7");
  });

  it("uses only the last X-Forwarded-For hop when Cloudflare's header is absent", () => {
    expect(
      clientIp(requestWith({ "x-forwarded-for": "1.2.3.4, 198.51.100.9" })),
    ).toBe("198.51.100.9");
    expect(clientIp(requestWith({ "x-forwarded-for": "  1.2.3.4  " }))).toBe(
      "1.2.3.4",
    );
  });

  it("falls back to a stable value when no address header is present", () => {
    expect(clientIp(requestWith({}))).toBe("unknown");
    expect(clientIp(requestWith({ "x-forwarded-for": " , " }))).toBe("unknown");
  });
});

describe("post-login redirect", () => {
  it("keeps same-site paths", () => {
    expect(safeInternalPath("/account")).toBe("/account");
    expect(safeInternalPath("/agency/dashboard?view=maids")).toBe(
      "/agency/dashboard?view=maids",
    );
    expect(safeInternalPath("/agencies/demo#reviews")).toBe(
      "/agencies/demo#reviews",
    );
  });

  it("rejects absolute URLs, protocol-relative paths and schemes", () => {
    for (const value of [
      "https://evil.example",
      "http://evil.example/login",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "/javascript:alert(1)",
      " /\t/evil",
    ])
      expect(safeInternalPath(value)).toBe("/");
  });

  it("uses the fallback for empty input", () => {
    expect(safeInternalPath(null)).toBe("/");
    expect(safeInternalPath("")).toBe("/");
    expect(safeInternalPath("   ")).toBe("/");
    expect(safeInternalPath(null, "")).toBe("");
  });
});

describe("production secret guard", () => {
  const strong = "a".repeat(48);

  it("allows development and test environments", () => {
    expect(
      findUnsafeProductionSecrets({
        NODE_ENV: "development",
        AUTH_SECRET: "replace-with-a-long-random-value",
      }),
    ).toEqual([]);
  });

  it("refuses placeholder or short secrets in production", () => {
    expect(
      findUnsafeProductionSecrets({
        NODE_ENV: "production",
        AUTH_SECRET: strong,
      }),
    ).toEqual([]);
    for (const AUTH_SECRET of [
      undefined,
      "",
      "short",
      "replace-with-a-long-random-value",
    ])
      expect(
        findUnsafeProductionSecrets({ NODE_ENV: "production", AUTH_SECRET })
          .length,
      ).toBeGreaterThan(0);
    expect(
      findUnsafeProductionSecrets({
        NODE_ENV: "production",
        AUTH_SECRET: strong,
        NEXTAUTH_SECRET: "b".repeat(48),
      }),
    ).toContain("AUTH_SECRET and NEXTAUTH_SECRET differ.");
  });

  it("requires a 32-byte TOTP key when one is configured", () => {
    expect(
      findUnsafeProductionSecrets({
        NODE_ENV: "production",
        AUTH_SECRET: strong,
        TOTP_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
      }),
    ).toEqual([]);
    expect(
      findUnsafeProductionSecrets({
        NODE_ENV: "production",
        AUTH_SECRET: strong,
        TOTP_ENCRYPTION_KEY: Buffer.alloc(16, 7).toString("base64"),
      }),
    ).toContain("TOTP_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  });
});
