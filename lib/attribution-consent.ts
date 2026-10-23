import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { boundedAcquisitionSource } from "@/lib/attribution";

export async function getConsentedAcquisitionSource(input: unknown) {
  const attribution = boundedAcquisitionSource(input);
  if (!attribution) return null;
  const jar = await cookies();
  const cookie = jar.get("fm-cookie-consent-id")?.value;
  if (!cookie || !/^[a-f0-9]{64}$/.test(cookie)) return null;
  const consent = await prisma.cookieConsent.findUnique({
    where: { consentKeyHash: createHash("sha256").update(cookie).digest("hex") },
    select: { analytics: true },
  });
  return consent?.analytics ? attribution : null;
}
