import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdminApi } from "@/lib/admin-auth";
import { requestIp, writeAdminAudit } from "@/lib/admin-audit";
import { hashBlockValue } from "@/lib/moderation";
import { prisma } from "@/lib/prisma";

const schema = z.object({ patternType: z.enum(["EMAIL", "PHONE", "IP"]), value: z.string().trim().min(3).max(254), reason: z.string().trim().min(5).max(1000) });

export async function GET(request: Request) {
  const access = await authorizeAdminApi("leads");
  if (!access.user) return NextResponse.json({ error: "Lead moderation permission required." }, { status: access.status });
  const params = new URL(request.url).searchParams;
  const search = params.get("q")?.trim();
  const status = params.get("status");
  const enquiries = await prisma.enquiry.findMany({ where: { ...(status && ["NEW", "CONTACTED", "CLOSED"].includes(status) ? { status: status as "NEW" | "CONTACTED" | "CLOSED" } : {}), ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { email: { contains: search, mode: "insensitive" as const } }, { phone: { contains: search } }, { message: { contains: search, mode: "insensitive" as const } }] } : {}) }, include: { agency: { select: { id: true, name: true, city: true } } }, orderBy: { createdAt: "desc" }, take: 300 });
  const anomalies = await prisma.$queryRaw<Array<{ sourceIpHash: string; volume: bigint }>>`SELECT "sourceIpHash", COUNT(*) AS volume FROM "Enquiry" WHERE "sourceIpHash" IS NOT NULL AND "createdAt" >= NOW() - INTERVAL '24 hours' GROUP BY "sourceIpHash" HAVING COUNT(*) >= 5 ORDER BY volume DESC LIMIT 30`;
  return NextResponse.json({ enquiries, anomalies: anomalies.map((item) => ({ ipHash: item.sourceIpHash, volume: Number(item.volume) })) });
}

export async function POST(request: Request) {
  const access = await authorizeAdminApi("leads");
  if (!access.user) return NextResponse.json({ error: "Lead moderation permission required." }, { status: access.status });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid block pattern." }, { status: 400 });
  const hash = hashBlockValue(parsed.data.value);
  const entry = await prisma.blockList.upsert({ where: { valueHash: hash }, create: { type: parsed.data.patternType, valueHash: hash, reason: parsed.data.reason }, update: { type: parsed.data.patternType, active: true, reason: parsed.data.reason } });
  await writeAdminAudit({ actorId: access.user.id, action: "BLOCK_PATTERN_ADD", entity: "BlockList", entityId: entry.id, before: null, after: { type: entry.type, valueHash: entry.valueHash, reason: entry.reason, active: entry.active }, ipAddress: requestIp(request) });
  return NextResponse.json({ blocked: true }, { status: 201 });
}
