import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const chatCookieName = "fm-chat-visitor";

function authSecret() {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret)
    throw new Error("Auth secret is required for chat continuation.");
  return secret;
}

export function createVisitorToken() {
  return randomBytes(32).toString("base64url");
}

export function hashVisitorToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function signVisitorToken(token: string) {
  return `${token}.${createHmac("sha256", authSecret()).update(token).digest("hex")}`;
}

export function verifyVisitorCookie(value?: string) {
  if (!value) return null;
  const [token, signature] = value.split(".");
  if (!token || !signature || !/^[\da-f]{64}$/i.test(signature)) return null;
  let secret: string;
  try {
    secret = authSecret();
  } catch {
    return null;
  }
  const expected = createHmac("sha256", secret).update(token).digest();
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length &&
    timingSafeEqual(received, expected)
    ? token
    : null;
}
