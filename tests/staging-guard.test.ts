import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertStagingWriteAllowed,
  checkStagingWriteGuard,
  loadEnvFile,
  StagingGuardError,
} from "../lib/security/staging-guard";

const ref = "abcdefghijklmnop";
const good = {
  APP_ENV: "staging",
  STAGING_PROJECT_REF: ref,
  DATABASE_URL: `postgresql://postgres.${ref}:pw@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true`,
  DIRECT_URL: `postgresql://postgres.${ref}:pw@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`,
};

describe("staging write guard", () => {
  it("allows a matching staging project", () => {
    expect(checkStagingWriteGuard(good)).toEqual({ ok: true });
    expect(checkStagingWriteGuard({ ...good, APP_ENV: "test" }).ok).toBe(true);
  });

  it("refuses other environments", () => {
    for (const APP_ENV of [undefined, "", "production", "development"])
      expect(checkStagingWriteGuard({ ...good, APP_ENV }).ok).toBe(false);
    expect(checkStagingWriteGuard({ ...good, NODE_ENV: "production" }).ok).toBe(false);
  });

  it("refuses a missing, placeholder or generic project ref", () => {
    for (const STAGING_PROJECT_REF of [undefined, "  ", "PASTE_PROJECT_REF_HERE", "abc", "postgres"])
      expect(checkStagingWriteGuard({ ...good, STAGING_PROJECT_REF }).ok).toBe(false);
  });

  it("refuses a mismatched project ref in either URL", () => {
    const other = "zzzzzzzzzzzzzzzz";
    const wrongPooled = checkStagingWriteGuard({ ...good, DATABASE_URL: good.DATABASE_URL.replaceAll(ref, other) });
    const wrongDirect = checkStagingWriteGuard({ ...good, DIRECT_URL: good.DIRECT_URL.replaceAll(ref, other) });
    expect(wrongPooled).toEqual({ ok: false, reason: "STAGING_PROJECT_REF does not appear in DATABASE_URL." });
    expect(wrongDirect).toEqual({ ok: false, reason: "STAGING_PROJECT_REF does not appear in DIRECT_URL." });
  });

  it("refuses when URLs are missing or malformed", () => {
    expect(checkStagingWriteGuard({ ...good, DATABASE_URL: undefined }).ok).toBe(false);
    expect(checkStagingWriteGuard({ ...good, DIRECT_URL: "not a url" }).ok).toBe(false);
  });

  it("does not let the password satisfy the ref check", () => {
    const url = `postgresql://postgres.other:${ref}@host.example.test:5432/postgres`;
    expect(checkStagingWriteGuard({ ...good, DATABASE_URL: url }).ok).toBe(false);
  });

  it("throws an error that never contains connection strings", () => {
    const env = { ...good, DIRECT_URL: "postgresql://u:secret-password@h.example.test/db" };
    expect(() => assertStagingWriteAllowed(env)).toThrow(StagingGuardError);
    expect(() => assertStagingWriteAllowed(env)).not.toThrow(/secret-password/);
  });

  it("loads env files and lets the file override inherited values", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "guard-"));
    const file = path.join(dir, ".env.staging");
    writeFileSync(file, `# comment\nAPP_ENV=staging\nDATABASE_URL="postgresql://x"\n`);
    const target: Record<string, string | undefined> = { APP_ENV: "production" };
    loadEnvFile(file, target);
    expect(target).toMatchObject({ APP_ENV: "staging", DATABASE_URL: "postgresql://x" });
    expect(() => loadEnvFile(path.join(dir, "missing"), target)).toThrow(StagingGuardError);
  });
});
