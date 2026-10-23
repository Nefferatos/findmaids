import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdminApi } from "@/lib/admin-auth";
import { requestIp, writeAdminAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";

const schema = z.object({ id: z.string().optional(), name: z.string().trim().min(2).max(80), priceMonthly: z.coerce.number().min(0).max(1_000_000), priceYearly: z.coerce.number().min(0).max(10_000_000), features: z.array(z.string().trim().min(1).max(200)).max(50), listingPriority: z.number().int().min(0).max(1000), featuredSlots: z.number().int().min(0).max(100), maxPhotos: z.number().int().min(0).max(500), leadLimit: z.number().int().min(0).nullable(), aiMonthlyBudgetPhp: z.number().min(0).max(100000).nullable(), isActive: z.boolean() });
export async function GET() {
	const access = await authorizeAdminApi("plans");
	if (!access.user) return NextResponse.json({ error: "Plan administration requires ADMIN." }, { status: access.status });
	const plans = await prisma.plan.findMany({ include: { _count: { select: { subscriptions: true } } }, orderBy: { listingPriority: "asc" } });
	return NextResponse.json({ plans });
}

export async function POST(request: Request) {
	const access = await authorizeAdminApi("plans");
	if (!access.user || access.user.role !== "ADMIN") return NextResponse.json({ error: "Plan changes require ADMIN." }, { status: 403 });
	const parsed = schema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return NextResponse.json({ error: "Invalid plan fields." }, { status: 400 });
	const { id, ...data } = parsed.data;
	const before = id ? await prisma.plan.findUnique({ where: { id } }) : null;
	if (id && !before) return NextResponse.json({ error: "Plan not found." }, { status: 404 });
	const plan = id ? await prisma.plan.update({ where: { id }, data }) : await prisma.plan.create({ data });
	await writeAdminAudit({ actorId: access.user.id, action: id ? "PLAN_UPDATE" : "PLAN_CREATE", entity: "Plan", entityId: plan.id, before, after: plan, ipAddress: requestIp(request) });
	return NextResponse.json({ plan, activeSubscriberPriceWarning: Boolean(before && (Number(before.priceMonthly) !== data.priceMonthly || Number(before.priceYearly) !== data.priceYearly)) }, { status: id ? 200 : 201 });
}
