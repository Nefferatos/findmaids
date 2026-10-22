import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { generateSecret, generateURI, verify } from "otplib";

function encryptionKey() {
  const value = process.env.TOTP_ENCRYPTION_KEY;
  if (!value)
    throw new Error(
      "TOTP_ENCRYPTION_KEY must be configured before enabling MFA.",
    );
  const key = Buffer.from(value, "base64");
  if (key.length !== 32)
    throw new Error(
      "TOTP_ENCRYPTION_KEY must be a base64-encoded 32-byte key.",
    );
  return key;
}

export function encryptTotpSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  return [
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}

export function decryptTotpSecret(value: string) {
  const [ivPart, tagPart, ciphertextPart] = value.split(".");
  if (!ivPart || !tagPart || !ciphertextPart)
    throw new Error("Invalid encrypted TOTP secret.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivPart, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function createTotpSecret(email: string) {
  return `${generateSecret()}|${email}`;
}

export function totpUri(secretValue: string, email: string) {
  const secret = secretValue.split("|")[0];
  return generateURI({ issuer: "FindMaids Admin", label: email, secret });
}

export async function verifyTotp(secretValue: string, token: string) {
  const result = await verify({
    token,
    secret: secretValue.split("|")[0],
    epochTolerance: 30,
  });
  return result.valid;
}
