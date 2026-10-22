import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { reserveInvoiceNumber } from "@/lib/payments/invoices";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

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
  if (
    !(await checkRateLimit(`bank-checkout:${session.user.id}`, 5, 3600)).allowed
  )
    return NextResponse.json(
      { error: "Checkout limit reached." },
      { status: 429 },
    );
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Select a valid plan and billing period." },
      { status: 400 },
    );
  const [agency, plan, settings] = await Promise.all([
    prisma.agency.findFirst({ where: { ownerId: session.user.id } }),
    prisma.plan.findFirst({
      where: { id: parsed.data.planId, isActive: true },
    }),
    prisma.adminSetting.findUnique({ where: { key: "bankDetails" } }),
  ]);
  if (!agency || agency.status !== "APPROVED")
    return NextResponse.json(
      { error: "Approved agency required." },
      { status: 403 },
    );
  if (!plan)
    return NextResponse.json({ error: "Select a paid plan." }, { status: 400 });
  const amount =
    parsed.data.billingPeriod === "YEARLY"
      ? Number(plan.priceYearly)
      : Number(plan.priceMonthly);
  if (amount <= 0)
    return NextResponse.json(
      { error: "Select a paid plan for the chosen billing period." },
      { status: 400 },
    );
  const vatRate = 0.12;
  const netAmount = Math.round((amount / (1 + vatRate)) * 100) / 100;
  const vatAmount = Math.round((amount - netAmount) * 100) / 100;
  const referenceCode = `FM-${new Date().getUTCFullYear()}-${randomBytes(5).toString("hex").toUpperCase()}`;
  const expiry = new Date(Date.now() + 5 * 86_400_000);
  const created = await prisma.$transaction(async (tx) => {
    const invoiceNumber = await reserveInvoiceNumber(tx);
    const subscription = await tx.subscription.create({
      data: {
        agencyId: agency.id,
        planId: plan.id,
        status: "PENDING",
        startDate: new Date(),
        autoRenew: false,
        billingPeriod: parsed.data.billingPeriod,
      },
    });
    const payment = await tx.payment.create({
      data: {
        subscriptionId: subscription.id,
        amount,
        currency: "PHP",
        status: "PENDING_BANK_TRANSFER",
        provider: "MANUAL",
        billingPeriod: parsed.data.billingPeriod,
        invoiceNumber,
        referenceCode,
        expiresAt: expiry,
      },
    });
    await tx.auditLog.create({
      data: {
        agencyId: agency.id,
        action: "MANUAL_BANK_PAYMENT_INITIATED",
        entity: "Payment",
        entityId: payment.id,
        metadata: { amount, referenceCode, expiresAt: expiry.toISOString() },
      },
    });
    return { payment, subscription };
  });
  return NextResponse.json(
    {
      paymentId: created.payment.id,
      referenceCode,
      amountPhp: amount,
      netPhp: netAmount,
      vatPhp: vatAmount,
      vatRate,
      expiresAt: expiry,
      bankDetails: settings?.value ?? null,
    },
    { status: 201 },
  );
}
