import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(
    secret && request.headers.get("authorization") === `Bearer ${secret}`,
  );
}

export async function GET(request: Request) {
  if (!authorized(request))
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const now = new Date();
  const oneDay = 86_400_000;
  let reminders = 0;
  let downgrades = 0;
  let expired = 0;

  for (const days of [7, 1]) {
    const start = new Date(now.getTime() + (days - 0.5) * oneDay);
    const end = new Date(now.getTime() + (days + 0.5) * oneDay);
    const due = await prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        endDate: { gte: start, lt: end },
        agency: { owner: { is: { email: { not: "" } } } },
      },
      include: {
        agency: { include: { owner: { select: { email: true } } } },
        plan: true,
      },
      take: 500,
    });
    for (const subscription of due) {
      const type = `EXPIRY_${days}D_${subscription.endDate?.toISOString().slice(0, 10)}`;
      try {
        await prisma.subscriptionNotice.create({
          data: { subscriptionId: subscription.id, noticeType: type },
        });
      } catch {
        continue;
      }
      if (subscription.agency.owner?.email)
        await sendEmail(
          subscription.agency.owner.email,
          `FindMaids plan expires in ${days} day${days === 1 ? "" : "s"}`,
          `${subscription.plan.name} expires ${subscription.endDate?.toLocaleDateString("en-PH")}. Visit your agency dashboard to renew or change plans.`,
        );
      reminders += 1;
    }
  }

  const scheduled = await prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      scheduledPlanId: { not: null },
      downgradeEffectiveAt: { lte: now },
    },
    include: {
      scheduledPlan: true,
      agency: { include: { owner: { select: { email: true } } } },
    },
    take: 500,
  });
  for (const subscription of scheduled) {
    if (!subscription.scheduledPlan) continue;
    if (Number(subscription.scheduledPlan.priceMonthly) > 0) {
      try {
        await prisma.subscriptionNotice.create({
          data: {
            subscriptionId: subscription.id,
            noticeType: `DOWNGRADE_PAYMENT_${subscription.downgradeEffectiveAt?.toISOString().slice(0, 10)}`,
          },
        });
      } catch {
        continue;
      }
      const checkoutUrl = new URL(
        `/agency/billing/checkout?plan=${subscription.scheduledPlan.id}`,
        process.env.NEXTAUTH_URL ?? "http://localhost:3000",
      ).toString();
      if (subscription.agency.owner?.email)
        await sendEmail(
          subscription.agency.owner.email,
          "Your plan change needs payment",
          `Your plan change to ${subscription.scheduledPlan.name} is ready. Complete payment here: ${checkoutUrl}`,
        );
      continue;
    }
    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          planId: subscription.scheduledPlan.id,
          scheduledPlanId: null,
          downgradeEffectiveAt: null,
          startDate: now,
          endDate: null,
          autoRenew: false,
        },
      }),
      prisma.adPlacement.updateMany({
        where: {
          agencyId: subscription.agencyId,
          status: { in: ["ACTIVE", "SCHEDULED"] },
        },
        data: { status: "CANCELLED" },
      }),
      prisma.auditLog.create({
        data: {
          agencyId: subscription.agencyId,
          action: "SUBSCRIPTION_DOWNGRADED",
          entity: "Subscription",
          entityId: subscription.id,
          metadata: { planId: subscription.scheduledPlan.id },
        },
      }),
    ]);
    downgrades += 1;
  }

  const unpaidExpiries = await prisma.subscription.findMany({
    where: { status: "ACTIVE", endDate: { lte: now } },
    select: { id: true, agencyId: true },
    take: 500,
  });
  for (const subscription of unpaidExpiries) {
    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: "PAST_DUE",
          graceEndsAt: new Date(now.getTime() + 3 * oneDay),
        },
      }),
      prisma.auditLog.create({
        data: {
          agencyId: subscription.agencyId,
          action: "SUBSCRIPTION_PAST_DUE",
          entity: "Subscription",
          entityId: subscription.id,
        },
      }),
    ]);
  }

  const graceExpired = await prisma.subscription.findMany({
    where: { status: "PAST_DUE", graceEndsAt: { lte: now } },
    select: { id: true, agencyId: true },
    take: 500,
  });
  const basicPlan = await prisma.plan.findUnique({
    where: { name: "Basic Free" },
  });
  for (const subscription of graceExpired) {
    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "EXPIRED", endDate: now },
      }),
      prisma.adPlacement.updateMany({
        where: {
          agencyId: subscription.agencyId,
          status: { in: ["ACTIVE", "SCHEDULED"] },
        },
        data: { status: "CANCELLED" },
      }),
      prisma.auditLog.create({
        data: {
          agencyId: subscription.agencyId,
          action: "SUBSCRIPTION_GRACE_EXPIRED",
          entity: "Subscription",
          entityId: subscription.id,
        },
      }),
      ...(basicPlan
        ? [
            prisma.subscription.upsert({
              where: { id: `basic-${subscription.agencyId}` },
              create: {
                id: `basic-${subscription.agencyId}`,
                agencyId: subscription.agencyId,
                planId: basicPlan.id,
                status: "ACTIVE",
                startDate: now,
                autoRenew: false,
                billingPeriod: "MONTHLY",
              },
              update: {
                planId: basicPlan.id,
                status: "ACTIVE",
                startDate: now,
                endDate: null,
                autoRenew: false,
                graceEndsAt: null,
                scheduledPlanId: null,
                downgradeEffectiveAt: null,
              },
            }),
          ]
        : []),
    ]);
    expired += 1;
  }

  const retentionCutoff = new Date(now.getTime() - 365 * oneDay);
  const anonymized = await prisma.enquiry.updateMany({
    where: { createdAt: { lt: retentionCutoff }, anonymizedAt: null },
    data: {
      name: "Deleted user",
      email: "deleted@privacy.invalid",
      phone: null,
      message: "[Anonymized under retention policy]",
      preferredStartDate: null,
      budget: null,
      privateNotes: null,
      anonymizedAt: now,
    },
  });
  return NextResponse.json({
    reminders,
    downgrades,
    expired,
    enquiriesAnonymized: anonymized.count,
  });
}
