import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdminApi } from "@/lib/admin-auth";
import { requestIp, writeAdminAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";

const settingsSchema = z.object({ key: z.enum(["bankDetails", "rankingWeights", "maintenanceMode", "siteContact", "featureFlags", "contentOverrides", "emailTemplates"]), value: z.unknown() });

export async function POST(request: Request) {
  const access = await authorizeAdminApi("settings");
  if (!access.user || access.user.role !== "ADMIN") return NextResponse.json({ error: "Settings preview requires ADMIN." }, { status: 403 });
  const parsed = z.object({ action: z.literal("previewRanking"), weights: z.object({ planPriority: z.number().min(0).max(100), rating: z.number().min(0).max(100), reviewCount: z.number().min(0).max(100), profileCompleteness: z.number().min(0).max(100), recentActivity: z.number().min(0).max(100) }) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid ranking weights." }, { status: 400 });
  const agencies = await prisma.agency.findMany({ where: { status: "APPROVED" }, include: { reviews: { where: { status: "PUBLISHED" }, select: { rating: true } }, subscriptions: { where: { status: "ACTIVE" }, include: { plan: { select: { listingPriority: true } } } } }, take: 100 });
  const preview = agencies.map((agency) => {
    const rating = agency.reviews.length ? agency.reviews.reduce((sum, item) => sum + item.rating, 0) / agency.reviews.length : 0;
    const completeness = agency.profileCompleteness / 100;
    const days = (Date.now() - agency.updatedAt.getTime()) / 86_400_000;
    const activity = Math.max(0, 1 - days / 90);
    const score = Math.max(0, ...agency.subscriptions.map((item) => item.plan.listingPriority)) * parsed.data.weights.planPriority + rating * parsed.data.weights.rating + agency.reviews.length * parsed.data.weights.reviewCount + completeness * parsed.data.weights.profileCompleteness + activity * parsed.data.weights.recentActivity;
    return { id: agency.id, name: agency.name, score };
  }).sort((a,b)=>b.score-a.score).slice(0,25);
  return NextResponse.json({ preview });
}

export async function GET() {
  const access = await authorizeAdminApi("settings");
  if (!access.user) return NextResponse.json({ error: "Settings permission required." }, { status: access.status });
  const settings = await prisma.adminSetting.findMany({ orderBy: { key: "asc" } });
  return NextResponse.json({ settings });
}

export async function PUT(request: Request) {
  const access = await authorizeAdminApi("settings");
  if (!access.user || access.user.role !== "ADMIN") return NextResponse.json({ error: "Settings changes require ADMIN." }, { status: 403 });
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid setting." }, { status: 400 });
  if (parsed.data.key === "rankingWeights") {
    const weights = z.object({ planPriority: z.number().min(0).max(100), rating: z.number().min(0).max(100), reviewCount: z.number().min(0).max(100), profileCompleteness: z.number().min(0).max(100), recentActivity: z.number().min(0).max(100) }).safeParse(parsed.data.value);
    if (!weights.success) return NextResponse.json({ error: "Invalid ranking weight configuration." }, { status: 400 });
  }
  const before = await prisma.adminSetting.findUnique({ where: { key: parsed.data.key } });
  const setting = await prisma.adminSetting.upsert({ where: { key: parsed.data.key }, create: { key: parsed.data.key, value: parsed.data.value as never, updatedById: access.user.id }, update: { value: parsed.data.value as never, updatedById: access.user.id } });
  await writeAdminAudit({ actorId: access.user.id, action: "ADMIN_SETTING_UPDATE", entity: "AdminSetting", entityId: setting.key, before: before?.value, after: setting.value, ipAddress: requestIp(request) });
  return NextResponse.json({ setting });
}