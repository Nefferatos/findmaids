import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { calculateProration } from "@/lib/payments/domain";
import { reserveInvoiceNumber } from "@/lib/payments/invoices";
import { getPaymentProvider } from "@/lib/payments/provider";
import { logger } from "@/lib/logger";

const schema = z.object({
  planId: z.string().min(1),
  billingPeriod: z.enum(["MONTHLY", "YEARLY"]),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "AGENCY")
    return NextResponse.json(
      { error: "Agency access required." },
      { status: 401 },
    );
  if (!(await checkRateLimit(`checkout:${session.user.id}`, 8, 3600)).allowed)
    return NextResponse.json(
      { error: "Checkout limit reached. Try again later." },
      { status: 429 },
    );
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Choose a valid plan and billing period." },
      { status: 400 },
    );
  const [agency, targetPlan, active] = await Promise.all([
    prisma.agency.findUnique({ where: { ownerId: session.user.id } }),
    prisma.plan.findFirst({
      where: { id: parsed.data.planId, isActive: true },
    }),
    prisma.subscription.findFirst({
      where: { agency: { ownerId: session.user.id }, status: "ACTIVE" },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!agency || agency.status !== "APPROVED")
    return NextResponse.json(
      { error: "An approved agency profile is required to check out." },
      { status: 403 },
    );
  if (!targetPlan)
    return NextResponse.json(
      { error: "Plan is unavailable." },
      { status: 404 },
    );
  const scheduledDowngradeDue = Boolean(
    active?.scheduledPlanId === targetPlan.id &&
    active.downgradeEffectiveAt &&
    active.downgradeEffectiveAt <= new Date(),
  );
  if (
    active &&
    targetPlan.listingPriority < active.plan.listingPriority &&
    !scheduledDowngradeDue
  ) {
    await prisma.subscription.update({
      where: { id: active.id },
      data: {
        scheduledPlanId: targetPlan.id,
        downgradeEffectiveAt: active.endDate,
        autoRenew: true,
        cancelAtPeriodEnd: false,
      },
    });
    return NextResponse.json({
      scheduled: true,
      effectiveAt: active.endDate,
      message: "Downgrade scheduled for the next renewal.",
    });
  }

  if (targetPlan.priceMonthly.toNumber() === 0) {
    if (!active || targetPlan.listingPriority >= active.plan.listingPriority)
      return NextResponse.json(
        { error: "Basic Free does not require checkout." },
        { status: 400 },
      );
    if (scheduledDowngradeDue) {
      await prisma.$transaction([
        prisma.subscription.update({
          where: { id: active.id },
          data: {
            planId: targetPlan.id,
            scheduledPlanId: null,
            downgradeEffectiveAt: null,
            startDate: new Date(),
            endDate: null,
            autoRenew: false,
            cancelAtPeriodEnd: false,
          },
        }),
        prisma.adPlacement.updateMany({
          where: {
            agencyId: agency.id,
            status: { in: ["ACTIVE", "SCHEDULED"] },
          },
          data: { status: "CANCELLED" },
        }),
        prisma.auditLog.create({
          data: {
            agencyId: agency.id,
            action: "SUBSCRIPTION_DOWNGRADED",
            entity: "Subscription",
            entityId: active.id,
            metadata: { planId: targetPlan.id },
          },
        }),
      ]);
      return NextResponse.json({
        scheduled: false,
        applied: true,
        message: "Basic Free downgrade applied.",
      });
    }
    await prisma.subscription.update({
      where: { id: active.id },
      data: {
        scheduledPlanId: targetPlan.id,
        downgradeEffectiveAt: active.endDate,
        autoRenew: true,
        cancelAtPeriodEnd: false,
      },
    });
    return NextResponse.json({
      scheduled: true,
      effectiveAt: active.endDate,
      message: "Basic Free downgrade scheduled for the next renewal.",
    });
  }

  let amount =
    parsed.data.billingPeriod === "YEARLY"
      ? targetPlan.priceYearly.toNumber()
      : targetPlan.priceMonthly.toNumber();
  let prorated = false;
  if (
    active?.endDate &&
    targetPlan.listingPriority > active.plan.listingPriority
  ) {
    const monthlyFromCurrent =
      active.billingPeriod === "YEARLY"
        ? active.plan.priceYearly.toNumber() / 12
        : active.plan.priceMonthly.toNumber();
    const monthlyFromTarget =
      parsed.data.billingPeriod === "YEARLY"
        ? targetPlan.priceYearly.toNumber() / 12
        : targetPlan.priceMonthly.toNumber();
    amount = calculateProration(
      monthlyFromCurrent,
      monthlyFromTarget,
      active.startDate,
      active.endDate,
    );
    prorated = true;
  }
  if (amount <= 0)
    return NextResponse.json(
      { error: "No charge is due for this plan change." },
      { status: 400 },
    );

  const paymentProvider = getPaymentProvider();
  const pending = await prisma.$transaction(async (tx) => {
    const invoice = await reserveInvoiceNumber(tx);
    const subscription = await tx.subscription.create({
      data: {
        agencyId: agency.id,
        planId: targetPlan.id,
        status: "PENDING",
        startDate: new Date(),
        ...(prorated && active?.endDate ? { endDate: active.endDate } : {}),
        autoRenew: false,
        billingPeriod: parsed.data.billingPeriod,
      },
    });
    const payment = await tx.payment.create({
      data: {
        subscriptionId: subscription.id,
        amount,
        currency: "PHP",
        status: "PENDING",
        provider: paymentProvider.name,
        invoiceNumber: invoice,
        billingPeriod: parsed.data.billingPeriod,
        prorated,
      },
    });
    return { subscription, payment };
  });
  let checkout;
  try {
    checkout = await paymentProvider.createCheckout({
      paymentId: pending.payment.id,
      amountPhp: amount,
      description: `FindMaids ${targetPlan.name} ${parsed.data.billingPeriod.toLowerCase()} listing`,
      customerEmail: session.user.email ?? agency.email,
      successUrl: new URL(
        `/agency/dashboard?view=billing&checkout=${pending.payment.id}`,
        process.env.NEXTAUTH_URL ?? "http://localhost:3000",
      ).toString(),
      cancelUrl: new URL(
        "/agency/dashboard?view=billing&checkout=cancelled",
        process.env.NEXTAUTH_URL ?? "http://localhost:3000",
      ).toString(),
    });
  } catch (error) {
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: pending.payment.id },
        data: { status: "FAILED" },
      }),
      prisma.subscription.update({
        where: { id: pending.subscription.id },
        data: { status: "CANCELLED" },
      }),
      prisma.auditLog.create({
        data: {
          agencyId: agency.id,
          action: "CHECKOUT_CREATION_FAILED",
          entity: "Payment",
          entityId: pending.payment.id,
        },
      }),
    ]);
    logger.error({ paymentId: pending.payment.id, errorType: error instanceof Error ? error.name : "unknown" }, "Checkout provider failed");
    return NextResponse.json(
      {
        error:
          "Secure checkout is temporarily unavailable. No payment was taken.",
      },
      { status: 502 },
    );
  }
  await prisma.payment.update({
    where: { id: pending.payment.id },
    data: {
      checkoutRef: checkout.checkoutId,
      providerRef: checkout.checkoutId,
    },
  });
    const vatRate = 0.12;
    const vatIncluded = Math.round((amount * vatRate / (1 + vatRate)) * 100) / 100;
    const netAmount = Math.round((amount - vatIncluded) * 100) / 100;
    return NextResponse.json({
      checkoutUrl: checkout.checkoutUrl,
      amountPhp: amount,
      netPhp: netAmount,
      vatPhp: vatIncluded,
      vatRate,
      invoiceNumber: pending.payment.invoiceNumber,
      prorated,
    });
}
