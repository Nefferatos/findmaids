import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdminApi } from "@/lib/admin-auth";
import { requestIp, writeAdminAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("extend"), subscriptionId: z.string().min(1), days: z.number().int().min(1).max(365), reason: z.string().trim().min(5).max(1000) }),
  z.object({ action: z.literal("comp"), agencyId: z.string().min(1), planId: z.string().min(1), days: z.number().int().min(1).max(365), reason: z.string().trim().min(5).max(1000) }),
  z.object({ action: z.literal("cancel"), subscriptionId: z.string().min(1), reason: z.string().trim().min(5).max(1000) }),
]);

export async function GET() {
  const access = await authorizeAdminApi("subscriptions");
  if (!access.user) return NextResponse.json({ error: "Subscription administration requires ADMIN." }, { status: access.status });
  const subscriptions = await prisma.subscription.findMany({ include: { agency: { select: { id: true, name: true, slug: true } }, plan: true }, orderBy: [{ endDate: "asc" }, { createdAt: "desc" }], take: 1000 });
  return NextResponse.json({ subscriptions });
}
export async function POST(request: Request) {
  const access = await authorizeAdminApi("subscriptions");
  if (!access.user || access.user.role !== "ADMIN") return NextResponse.json({ error: "Subscription changes require ADMIN." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid subscription action." }, { status: 400 });
  const ipAddress = requestIp(request);
  if (parsed.data.action === "comp") {
    const [agency, plan] = await Promise.all([prisma.agency.findUnique({ where: { id: parsed.data.agencyId } }), prisma.plan.findUnique({ where: { id: parsed.data.planId } })]);
    if (!agency || !plan) return NextResponse.json({ error: "Agency or plan not found." }, { status: 404 });
    const endDate = new Date(Date.now() + parsed.data.days * 86_400_000);
    const subscription = await prisma.subscription.create({ data: { agencyId: agency.id, planId: plan.id, status: "ACTIVE", startDate: new Date(), endDate, autoRenew: false } });
    await writeAdminAudit({ actorId: access.user.id, action: "SUBSCRIPTION_COMP", entity: "Subscription", entityId: subscription.id, agencyId: agency.id, after: { planId: plan.id, endDate, reason: parsed.data.reason }, ipAddress });
    return NextResponse.json({ subscription }, { status: 201 });
  }
  const before = await prisma.subscription.findUnique({ where: { id: parsed.data.subscriptionId } });
  if (!before) return NextResponse.json({ error: "Subscription not found." }, { status: 404 });
  const subscription = parsed.data.action === "extend"
    ? await prisma.subscription.update({ where: { id: before.id }, data: { endDate: new Date(Math.max(Date.now(), before.endDate?.getTime() ?? 0) + parsed.data.days * 86_400_000), status: "ACTIVE", graceEndsAt: null } })
    : await prisma.subscription.update({ where: { id: before.id }, data: { status: "CANCELLED", autoRenew: false, cancelAtPeriodEnd: true } });
  await writeAdminAudit({ actorId: access.user.id, action: `SUBSCRIPTION_${parsed.data.action.toUpperCase()}`, entity: "Subscription", entityId: subscription.id, agencyId: before.agencyId, before, after: { subscription, reason: parsed.data.reason }, ipAddress });
  return NextResponse.json({ subscription });
}
