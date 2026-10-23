import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { requestIp, writeAdminAudit } from "@/lib/admin-audit";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("grant"),
    agencyId: z.string().min(1),
    days: z.coerce.number().int().min(1).max(365).default(90),
    reason: z.string().trim().min(5).max(1000),
  }),
  z.object({
    action: z.literal("extend"),
    agencyId: z.string().min(1),
    days: z.coerce.number().int().min(1).max(365),
    reason: z.string().trim().min(5).max(1000),
  }),
  z.object({
    action: z.literal("revoke"),
    agencyId: z.string().min(1),
    reason: z.string().trim().min(5).max(1000),
  }),
]);

export async function POST(request: Request) {
  const access = await authorizeAdminApi("plans");
  if (!access.user || access.user.role !== "ADMIN")
    return NextResponse.json(
      { error: "ADMIN plans permission required." },
      { status: access.status || 403 },
    );
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid founding period action." },
      { status: 400 },
    );
  const agency = await prisma.agency.findUnique({
    where: { id: parsed.data.agencyId },
  });
  if (!agency)
    return NextResponse.json({ error: "Agency not found." }, { status: 404 });
  const active = await prisma.subscription.findFirst({
    where: { agencyId: agency.id, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    include: { plan: true },
  });
  const gold = await prisma.plan.findUnique({ where: { name: "Gold" } });
  const basic = await prisma.plan.findUnique({ where: { name: "Basic Free" } });
  if (!gold || !basic)
    return NextResponse.json(
      {
        error:
          "Gold and Basic Free plans must exist before granting a founding period.",
      },
      { status: 409 },
    );
  const now = new Date();
  let subscriptionId: string | undefined;
  let startsAt = agency.foundingPeriodStartsAt;
  let endsAt = agency.foundingPeriodEndsAt;

  if (parsed.data.action === "grant") {
    if (
      active &&
      Number(active.plan.priceMonthly) > 0 &&
      !active.foundingAgency
    )
      return NextResponse.json(
        {
          error:
            "Cannot grant a founding period over an active paid subscription.",
        },
        { status: 409 },
      );
    startsAt = now;
    endsAt = new Date(now.getTime() + parsed.data.days * 86_400_000);
    const subscription = active
      ? await prisma.subscription.update({
          where: { id: active.id },
          data: {
            planId: gold.id,
            foundingAgency: true,
            foundingPeriodStartsAt: startsAt,
            foundingPeriodEndsAt: endsAt,
            startDate: startsAt,
            endDate: endsAt,
            autoRenew: false,
            cancelAtPeriodEnd: false,
          },
        })
      : await prisma.subscription.create({
          data: {
            agencyId: agency.id,
            planId: gold.id,
            status: "ACTIVE",
            startDate: startsAt,
            endDate: endsAt,
            autoRenew: false,
            billingPeriod: "MONTHLY",
            foundingAgency: true,
            foundingPeriodStartsAt: startsAt,
            foundingPeriodEndsAt: endsAt,
          },
        });
    subscriptionId = subscription.id;
    await prisma.adPlacement.create({
      data: {
        agencyId: agency.id,
        type: "FEATURED",
        status: "ACTIVE",
        startDate: startsAt,
        endDate: endsAt,
        foundingGrant: true,
      },
    });
  } else {
    if (!active?.foundingAgency || !active.foundingPeriodEndsAt)
      return NextResponse.json(
        { error: "No active founding period exists for this agency." },
        { status: 409 },
      );
    subscriptionId = active.id;
    if (parsed.data.action === "extend") {
      endsAt = new Date(
        Math.max(now.getTime(), active.foundingPeriodEndsAt.getTime()) +
          parsed.data.days * 86_400_000,
      );
      await prisma.subscription.update({
        where: { id: active.id },
        data: { endDate: endsAt, foundingPeriodEndsAt: endsAt },
      });
      await prisma.adPlacement.updateMany({
        where: { agencyId: agency.id, foundingGrant: true, status: "ACTIVE" },
        data: { endDate: endsAt },
      });
    } else {
      endsAt = now;
      await prisma.subscription.update({
        where: { id: active.id },
        data: {
          planId: basic.id,
          endDate: null,
          foundingAgency: false,
          foundingPeriodEndsAt: now,
          autoRenew: false,
        },
      });
      await prisma.adPlacement.updateMany({
        where: {
          agencyId: agency.id,
          foundingGrant: true,
          status: { in: ["ACTIVE", "SCHEDULED"] },
        },
        data: { status: "CANCELLED", endDate: now },
      });
    }
  }

  await prisma.agency.update({
    where: { id: agency.id },
    data: {
      foundingAgency: parsed.data.action !== "revoke",
      foundingPeriodStartsAt:
        parsed.data.action === "grant"
          ? startsAt
          : agency.foundingPeriodStartsAt,
      foundingPeriodEndsAt: endsAt,
    },
  });
  await writeAdminAudit({
    actorId: access.user.id,
    action: `FOUNDING_PERIOD_${parsed.data.action.toUpperCase()}`,
    entity: "Subscription",
    entityId: subscriptionId,
    agencyId: agency.id,
    before: {
      foundingAgency: agency.foundingAgency,
      foundingPeriodEndsAt: agency.foundingPeriodEndsAt,
    },
    after: {
      foundingAgency: parsed.data.action !== "revoke",
      foundingPeriodStartsAt: startsAt,
      foundingPeriodEndsAt: endsAt,
      reason: parsed.data.reason,
    },
    ipAddress: requestIp(request),
  });
  return NextResponse.json({
    agencyId: agency.id,
    subscriptionId,
    startsAt,
    endsAt,
    action: parsed.data.action,
  });
}
