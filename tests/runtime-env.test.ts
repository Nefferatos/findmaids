import { describe, expect, it } from "vitest";
import { runtimeAuthSecret, runtimeEnv } from "@/lib/runtime-env";

/** The app reads env through globalThis so bundlers cannot inline the values. */
const env = (
  globalThis as { process: { env: Record<string, string | undefined> } }
).process.env;

describe("runtime env", () => {
  it("reads values that exist at runtime", () => {
    const original = env.CLINE_RUNTIME_ENV_PROBE;
    env.CLINE_RUNTIME_ENV_PROBE = "  value  ";
    try {
      expect(runtimeEnv("CLINE_RUNTIME_ENV_PROBE")).toBe("value");
    } finally {
      if (original === undefined) delete env.CLINE_RUNTIME_ENV_PROBE;
      else env.CLINE_RUNTIME_ENV_PROBE = original;
    }
  });

  it("treats missing and blank values as unset", () => {
    const original = env.CLINE_RUNTIME_ENV_PROBE;
    env.CLINE_RUNTIME_ENV_PROBE = "   ";
    try {
      expect(runtimeEnv("CLINE_RUNTIME_ENV_PROBE")).toBeUndefined();
      expect(runtimeEnv("CLINE_RUNTIME_ENV_MISSING")).toBeUndefined();
    } finally {
      if (original === undefined) delete env.CLINE_RUNTIME_ENV_PROBE;
      else env.CLINE_RUNTIME_ENV_PROBE = original;
    }
  });

  it("prefers AUTH_SECRET and falls back to NEXTAUTH_SECRET", () => {
    const originalAuth = env.AUTH_SECRET;
    const originalNext = env.NEXTAUTH_SECRET;
    try {
      env.AUTH_SECRET = "auth-secret";
      env.NEXTAUTH_SECRET = "nextauth-secret";
      expect(runtimeAuthSecret()).toBe("auth-secret");
      // An empty AUTH_SECRET (a blank CI/Worker variable) must not win.
      env.AUTH_SECRET = "";
      expect(runtimeAuthSecret()).toBe("nextauth-secret");
      delete env.AUTH_SECRET;
      delete env.NEXTAUTH_SECRET;
      expect(runtimeAuthSecret()).toBeUndefined();
    } finally {
      if (originalAuth === undefined) delete env.AUTH_SECRET;
      else env.AUTH_SECRET = originalAuth;
      if (originalNext === undefined) delete env.NEXTAUTH_SECRET;
      else env.NEXTAUTH_SECRET = originalNext;
    }
  });
});
