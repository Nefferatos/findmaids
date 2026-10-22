import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  agencyId: z.string().min(1),
  type: z.enum([
    "profile_view",
    "phone_click",
    "whatsapp_click",
    "website_click",
  ]),
});

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await checkRateLimit(`analytics:${ip}`, 60, 3600)).allowed)
    return NextResponse.json({ ok: false }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid analytics event." },
      { status: 400 },
    );
  const agency = await prisma.agency.findFirst({
    where: { id: parsed.data.agencyId, status: "APPROVED" },
    select: { id: true },
  });
  if (!agency) return NextResponse.json({ ok: false }, { status: 404 });
  await prisma.analyticsEvent.create({ data: parsed.data });
  return NextResponse.json({ ok: true }, { status: 201 });
}
