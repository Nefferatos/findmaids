import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  analytics: z.boolean(),
  policyVersion: z.literal("cookie-policy-v1-draft"),
});
const cookieName = "fm-cookie-consent-id";

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid consent choice." },
      { status: 400 },
    );
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  if (!(await checkRateLimit(`cookie-consent:${ip}`, 10, 3600)).allowed)
    return NextResponse.json(
      { error: "Please try again later." },
      { status: 429 },
    );
  const jar = await cookies();
  let key = jar.get(cookieName)?.value;
  if (!key || !/^[a-f0-9]{64}$/.test(key))
    key = randomBytes(32).toString("hex");
  const consentKeyHash = createHash("sha256").update(key).digest("hex");
  const session = await auth();
  await prisma.cookieConsent.upsert({
    where: { consentKeyHash },
    create: {
      consentKeyHash,
      userId: session?.user?.id || null,
      policyVersion: parsed.data.policyVersion,
      analytics: parsed.data.analytics,
      capturedAt: new Date(),
    },
    update: {
      userId: session?.user?.id || null,
      policyVersion: parsed.data.policyVersion,
      analytics: parsed.data.analytics,
      capturedAt: new Date(),
    },
  });
  const response = NextResponse.json({ saved: true });
  response.cookies.set(cookieName, key, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
