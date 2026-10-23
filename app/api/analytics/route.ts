import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";

const schema = z.discriminatedUnion("type", [
  z.object({
    type: z.enum(["SITE_VISIT", "CHAT_OPENED", "CHAT_MESSAGE_SENT", "CHAT_ENQUIRY_CREATED"]),
    anonymousVisitorId: z.string().uuid(),
  }).strict(),
  z.object({
    agencyId: z.string().min(1),
    type: z.enum([
      "profile_view",
      "phone_click",
      "whatsapp_click",
      "website_click",
      "placement_impression",
      "placement_click",
    ]),
  }).strict(),
]);

export async function POST(request: Request) {
  const jar = await cookies();
  const consentKey = jar.get("fm-cookie-consent-id")?.value;
  if (!consentKey || !/^[a-f0-9]{64}$/.test(consentKey))
    return NextResponse.json(
      { error: "Analytics consent required." },
      { status: 403 },
    );
  const consent = await prisma.cookieConsent.findUnique({
    where: {
      consentKeyHash: createHash("sha256").update(consentKey).digest("hex"),
    },
    select: { analytics: true },
  });
  if (!consent?.analytics)
    return NextResponse.json(
      { error: "Analytics consent required." },
      { status: 403 },
    );
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  if (!(await checkRateLimit(`analytics:${ip}`, 60, 3600)).allowed)
    return NextResponse.json({ ok: false }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid analytics event." },
      { status: 400 },
    );
  if ("anonymousVisitorId" in parsed.data) {
    await prisma.analyticsEvent.create({
      data: {
        type: parsed.data.type,
        metadata: { anonymousVisitorId: parsed.data.anonymousVisitorId },
      },
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  }
  const agency = await prisma.agency.findFirst({
    where: { id: parsed.data.agencyId, status: "APPROVED" },
    select: { id: true },
  });
  if (!agency) return NextResponse.json({ ok: false }, { status: 404 });
  if (parsed.data.type === "placement_impression") {
    const since = new Date(Date.now() - 86_400_000);
    const visitorKey = createHash("sha256").update(ip).digest("hex");
    const duplicate = await prisma.analyticsEvent.findFirst({
      where: {
        agencyId: agency.id,
        type: parsed.data.type,
        createdAt: { gte: since },
        metadata: { path: ["visitorKey"], equals: visitorKey },
      },
      select: { id: true },
    });
    if (duplicate) return NextResponse.json({ ok: true, duplicate: true });
    await prisma.analyticsEvent.create({
      data: { ...parsed.data, metadata: { visitorKey } },
    });
    await prisma.adPlacement.updateMany({
      where: {
        agencyId: agency.id,
        status: "ACTIVE",
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
      data: { impressions: { increment: 1 } },
    });
  } else {
    await prisma.analyticsEvent.create({ data: parsed.data });
    if (
      [
        "phone_click",
        "whatsapp_click",
        "website_click",
        "placement_click",
      ].includes(parsed.data.type)
    ) {
      await prisma.adPlacement.updateMany({
        where: {
          agencyId: agency.id,
          status: "ACTIVE",
          startDate: { lte: new Date() },
          endDate: { gte: new Date() },
        },
        data: { clicks: { increment: 1 } },
      });
    }
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
