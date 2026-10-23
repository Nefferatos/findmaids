import { createHmac, randomBytes } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { verifyImpersonationCookie } from "@/lib/impersonation";
import { decryptTotpSecret, encryptTotpSecret } from "@/lib/totp";
import { adminMfaSatisfied } from "@/lib/security/admin-mfa";

const originalSecret = process.env.AUTH_SECRET;
const originalTotpKey = process.env.TOTP_ENCRYPTION_KEY;
afterEach(() => {
  if (originalSecret === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = originalSecret;
  if (originalTotpKey === undefined) delete process.env.TOTP_ENCRYPTION_KEY;
  else process.env.TOTP_ENCRYPTION_KEY = originalTotpKey;
});

function signedCookie(session: {
  adminId: string;
  agencyId: string;
  userId: string;
  nonce: string;
  expiresAt: number;
}) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = createHmac("sha256", process.env.AUTH_SECRET!)
    .update(payload)
    .digest("hex");
  return `${payload}.${signature}`;
}

describe("admin security helpers", () => {
  it("requires TOTP enrollment and verified session for protected ADMIN access", () => {
    expect(adminMfaSatisfied({ role: "ADMIN", permission: "settings", totpEnabled: false, sessionVerified: false })).toBe(false);
    expect(adminMfaSatisfied({ role: "ADMIN", permission: "settings", totpEnabled: true, sessionVerified: false })).toBe(false);
    expect(adminMfaSatisfied({ role: "ADMIN", permission: "settings", totpEnabled: true, sessionVerified: true })).toBe(true);
    expect(adminMfaSatisfied({ role: "ADMIN", permission: "twoFactor", totpEnabled: false, sessionVerified: false })).toBe(true);
    expect(adminMfaSatisfied({ role: "STAFF", permission: "reviews", totpEnabled: false, sessionVerified: false })).toBe(true);
  });

  it("accepts an unexpired signed impersonation cookie and rejects tampering", async () => {
    process.env.AUTH_SECRET = "test-secret";
    const cookie = signedCookie({
      adminId: "admin-1",
      agencyId: "agency-1",
      userId: "owner-1",
      nonce: "nonce",
      expiresAt: Date.now() + 60_000,
    });
    await expect(verifyImpersonationCookie(cookie)).resolves.toMatchObject({
      agencyId: "agency-1",
      userId: "owner-1",
    });
    await expect(
      verifyImpersonationCookie(`${cookie.slice(0, -1)}0`),
    ).resolves.toBeNull();
  });

  it("rejects expired impersonation cookies", async () => {
    process.env.AUTH_SECRET = "test-secret";
    const cookie = signedCookie({
      adminId: "admin-1",
      agencyId: "agency-1",
      userId: "owner-1",
      nonce: "nonce",
      expiresAt: Date.now() - 1,
    });
    await expect(verifyImpersonationCookie(cookie)).resolves.toBeNull();
  });

  it("encrypts TOTP secrets with authenticated encryption", () => {
    process.env.TOTP_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    const secret = "JBSWY3DPEHPK3PXP";
    const encrypted = encryptTotpSecret(secret);
    expect(encrypted).not.toContain(secret);
    expect(decryptTotpSecret(encrypted)).toBe(secret);
    const [iv, tag, ciphertext] = encrypted.split(".");
    const changedTag = `${tag[0] === "A" ? "B" : "A"}${tag.slice(1)}`;
    expect(() =>
      decryptTotpSecret(`${iv}.${changedTag}.${ciphertext}`),
    ).toThrow();
  });
});
