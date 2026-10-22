export type ImpersonationSession = {
  adminId: string;
  agencyId: string;
  userId: string;
  nonce: string;
  expiresAt: number;
};

function base64UrlToBytes(value: string) {
  const standard = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = standard.padEnd(Math.ceil(standard.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function hexToBytes(value: string) {
  if (!/^[\da-f]{64}$/i.test(value)) return null;
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (byte) =>
    Number.parseInt(byte, 16),
  );
}

export async function verifyImpersonationCookie(
  value?: string,
): Promise<ImpersonationSession | null> {
  if (!value) return null;
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  try {
    const received = hexToBytes(signature);
    if (!received) return null;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    if (
      !(await crypto.subtle.verify(
        "HMAC",
        key,
        received,
        new TextEncoder().encode(payload),
      ))
    )
      return null;
    const session = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(payload)),
    ) as ImpersonationSession;
    if (
      !session.adminId ||
      !session.agencyId ||
      !session.userId ||
      session.expiresAt <= Date.now()
    )
      return null;
    return session;
  } catch {
    return null;
  }
}
