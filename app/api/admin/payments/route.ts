import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdminApi } from "@/lib/admin-auth";
import { requestIp, writeAdminAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";
import { PayMongoProvider } from "@/lib/payments/provider";
import { processPaymentWebhook } from "@/lib/payments/service";
import { calculateRefund, classifyBankPayment } from "@/lib/admin-workflows";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("mark_paid"),
    paymentId: z.string().min(1),
    receivedAmount: z.coerce.number().positive(),
    bankReference: z.string().trim().min(3).max(160),
    receivedAt: z.iso.datetime(),
    note: z.string().max(1000).optional(),
  }),
  z.object({
    action: z.literal("partial"),
    paymentId: z.string().min(1),
    receivedAmount: z.coerce.number().positive(),
    bankReference: z.string().trim().min(3).max(160),
    receivedAt: z.iso.datetime(),
    note: z.string().trim().min(3).max(1000),
  }),
  z.object({
    action: z.literal("reject"),
    paymentId: z.string().min(1),
    reason: z.string().trim().min(5).max(1000),
  }),
  z.object({
    action: z.literal("expire"),
    paymentId: z.string().min(1),
    reason: z.string().trim().min(5).max(1000),
  }),
  z.object({
    action: z.literal("refund"),
    confirmed: z.literal(true),
    paymentId: z.string().min(1),
    amount: z.coerce.number().positive(),
    reason: z.string().trim().min(5).max(1000),
  }),
]);

export async function GET(request: Request) {
  const access = await authorizeAdminApi("payments");
  if (!access.user)
    return NextResponse.json(
      { error: "ADMIN payment permission required." },
      { status: access.status },
    );
  const params = new URL(request.url).searchParams;
  const status = params.get("status");
  const provider = params.get("provider");
  const agencyId = params.get("agencyId");
  const from = params.get("from");
  const to = params.get("to");
  const payments = await prisma.payment.findMany({
    where: {
      ...(status &&
      [
        "PENDING",
        "PENDING_BANK_TRANSFER",
        "PARTIAL",
        "PAID",
        "FAILED",
        "REFUNDED",
        "EXPIRED",
      ].includes(status)
        ? {
            status: status as
              | "PENDING"
              | "PENDING_BANK_TRANSFER"
              | "PARTIAL"
              | "PAID"
              | "FAILED"
              | "REFUNDED"
              | "EXPIRED",
          }
        : {}),
      ...(provider ? { provider } : {}),
      ...(agencyId ? { subscription: { agencyId } } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    },
    include: {
      subscription: {
        include: {
          agency: { select: { id: true, name: true, slug: true } },
          plan: true,
        },
      },
      reconciledBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const proofId = params.get("proof");
  if (proofId) {
    const payment = await prisma.payment.findUnique({
      where: { id: proofId },
      select: { proofUrl: true, provider: true },
    });
    if (!payment || payment.provider !== "MANUAL" || !payment.proofUrl)
      return NextResponse.json({ error: "Proof not found." }, { status: 404 });
    try {
      const filepath = path.join(
        process.cwd(),
        "private",
        "bank-proofs",
        path.basename(payment.proofUrl),
      );
      const data = await readFile(filepath);
      const contentType = payment.proofUrl.endsWith(".pdf")
        ? "application/pdf"
        : payment.proofUrl.endsWith(".png")
          ? "image/png"
          : payment.proofUrl.endsWith(".jpg")
            ? "image/jpeg"
            : "image/webp";
      return new Response(data, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "private, no-store",
          "Content-Disposition": "inline",
        },
      });
    } catch {
      return NextResponse.json(
        { error: "Stored proof file is unavailable." },
        { status: 404 },
      );
    }
  }
  if (params.get("format") === "csv") {
    const q = (value: unknown) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [
      "invoice,agency,plan,provider,status,amount,currency,reference,createdAt",
      ...payments.map((p) =>
        [
          p.invoiceNumber,
          p.subscription.agency.name,
          p.subscription.plan.name,
          p.provider,
          p.status,
          p.amount,
          p.currency,
          p.referenceCode ?? p.bankReference ?? p.providerRef,
          p.createdAt.toISOString(),
        ]
          .map(q)
          .join(","),
      ),
    ].join("\r\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=findmaids-payments.csv",
        "Cache-Control": "private, no-store",
      },
    });
  }
  return NextResponse.json({ payments });
}

export async function POST(request: Request) {
  const access = await authorizeAdminApi("payments");
  if (!access.user || access.user.role !== "ADMIN")
    return NextResponse.json(
      { error: "ADMIN payment permission required." },
      { status: 403 },
    );
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid payment action." },
      { status: 400 },
    );
  const payment = await prisma.payment.findUnique({
    where: { id: parsed.data.paymentId },
    include: { subscription: { include: { agency: true, plan: true } } },
  });
  if (!payment)
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  const before = {
    status: payment.status,
    amount: Number(payment.amount),
    receivedAmount: payment.receivedAmount
      ? Number(payment.receivedAmount)
      : null,
    provider: payment.provider,
    referenceCode: payment.referenceCode,
    bankReference: payment.bankReference,
  };
  const ipAddress = requestIp(request);
  if (parsed.data.action === "mark_paid" || parsed.data.action === "partial") {
    if (
      payment.provider !== "MANUAL" ||
      !["PENDING_BANK_TRANSFER", "PARTIAL"].includes(payment.status)
    )
      return NextResponse.json(
        { error: "Only pending manual bank transfers can be reconciled." },
        { status: 409 },
      );
    if (
      parsed.data.action === "mark_paid" &&
      parsed.data.receivedAmount !== Number(payment.amount)
    )
      return NextResponse.json(
        {
          error:
            "Received amount must exactly match expected amount. Use partial or investigate a mismatch.",
        },
        { status: 409 },
      );
    if (
      parsed.data.action === "partial" &&
      parsed.data.receivedAmount >= Number(payment.amount)
    )
      return NextResponse.json(
        { error: "Partial amount must be less than the expected amount." },
        { status: 400 },
      );
    const duplicateReference = await prisma.payment.findFirst({
      where: {
        id: { not: payment.id },
        bankReference: parsed.data.bankReference,
      },
      select: { id: true },
    });
    const classification = classifyBankPayment({
      expected: Number(payment.amount),
      received: parsed.data.receivedAmount,
      reference: parsed.data.bankReference,
      duplicateReference: Boolean(duplicateReference),
      expiresAt: payment.expiresAt,
    });
    if (classification === "DUPLICATE_REFERENCE")
      return NextResponse.json(
        {
          error: "Bank reference is already attached to another payment.",
          flag: classification,
        },
        { status: 409 },
      );
    if (classification === "EXPIRED")
      return NextResponse.json(
        {
          error:
            "Payment has expired. Recreate it or investigate proof marked after expiry.",
          flag: classification,
        },
        { status: 409 },
      );
    if (classification === "MISMATCH")
      return NextResponse.json(
        {
          error:
            "Received amount is higher than expected or invalid. Escalate this mismatch for review.",
          flag: classification,
        },
        { status: 409 },
      );
    if (parsed.data.action === "mark_paid" && classification !== "EXACT")
      return NextResponse.json(
        {
          error:
            "Received amount must exactly match. Record a smaller amount as partial.",
        },
        { status: 409 },
      );
    if (parsed.data.action === "partial" && classification !== "PARTIAL")
      return NextResponse.json(
        {
          error:
            "Partial action requires a received amount below the expected amount.",
        },
        { status: 409 },
      );
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        receivedAmount: parsed.data.receivedAmount,
        bankReference: parsed.data.bankReference,
        receivedAt: new Date(parsed.data.receivedAt),
        reconciledById: access.user.id,
        reconciliationNote: parsed.data.note,
      },
    });
    if (classification === "PARTIAL") {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "PARTIAL" },
      });
      await writeAdminAudit({
        actorId: access.user.id,
        action: "BANK_PAYMENT_PARTIAL",
        entity: "Payment",
        entityId: payment.id,
        agencyId: payment.subscription.agencyId,
        before,
        after: parsed.data,
        ipAddress,
      });
      return NextResponse.json({ status: "PARTIAL" });
    }
    const result = await processPaymentWebhook(
      {
        eventId: `manual-${payment.id}-${parsed.data.bankReference}`,
        type: "manual.payment.paid",
        paymentReference: payment.id,
        status: "paid",
      },
      "MANUAL",
    );
    await prisma.auditLog.create({
      data: {
        userId: access.user.id,
        agencyId: payment.subscription.agencyId,
        action: "BANK_PAYMENT_RECONCILED",
        entity: "Payment",
        entityId: payment.id,
        before,
        after: {
          receivedAmount: parsed.data.receivedAmount,
          bankReference: parsed.data.bankReference,
          receivedAt: parsed.data.receivedAt,
        },
        ipAddress,
      },
    });
    return NextResponse.json({
      status: result.paid ? "PAID" : "DUPLICATE",
      duplicate: result.duplicate,
    });
  }
  if (parsed.data.action === "reject" || parsed.data.action === "expire") {
    if (
      payment.provider !== "MANUAL" ||
      !["PENDING_BANK_TRANSFER", "PARTIAL"].includes(payment.status)
    )
      return NextResponse.json(
        { error: "Only pending manual transfers may be rejected or expired." },
        { status: 409 },
      );
    const status = parsed.data.action === "reject" ? "FAILED" : "EXPIRED";
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          status,
          reconciliationNote: parsed.data.reason,
          reconciledById: access.user.id,
        },
      }),
      prisma.subscription.update({
        where: { id: payment.subscriptionId },
        data: { status: "CANCELLED" },
      }),
      prisma.auditLog.create({
        data: {
          userId: access.user.id,
          agencyId: payment.subscription.agencyId,
          action: `BANK_PAYMENT_${status}`,
          entity: "Payment",
          entityId: payment.id,
          before,
          after: { status, reason: parsed.data.reason },
          ipAddress,
        },
      }),
    ]);
    return NextResponse.json({ status });
  }
  if (payment.status !== "PAID")
    return NextResponse.json(
      { error: "Only paid payments may be refunded." },
      { status: 409 },
    );
  const alreadyRefunded = Number(payment.refundAmount ?? 0);
  let refund;
  try {
    refund = calculateRefund(
      alreadyRefunded,
      Number(payment.amount),
      parsed.data.amount,
      true,
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid refund." },
      { status: 400 },
    );
  }
  if (payment.provider === "PAYMONGO") {
    if (!payment.providerRef || payment.providerRef === payment.checkoutRef)
      return NextResponse.json(
        {
          error:
            "Verified PayMongo payment transaction ID is not available; do not issue an automatic refund yet.",
        },
        { status: 409 },
      );
    await new PayMongoProvider().refund(
      payment.providerRef,
      parsed.data.amount,
    );
  }
  const refundStatus = refund.fullyRefunded ? "REFUNDED" : "PAID";
  const creditNote = `FM-CN-${new Date().getUTCFullYear()}-${payment.id.slice(-6).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: refundStatus,
        refundAmount: refund.refunded,
        refundReason: parsed.data.reason,
        creditNoteNumber: creditNote,
      },
    }),
    ...(refundStatus === "REFUNDED"
      ? [
          prisma.subscription.update({
            where: { id: payment.subscriptionId },
            data: {
              status: "CANCELLED",
              autoRenew: false,
              cancelAtPeriodEnd: true,
            },
          }),
        ]
      : []),
    prisma.auditLog.create({
      data: {
        userId: access.user.id,
        agencyId: payment.subscription.agencyId,
        action: "PAYMENT_REFUND",
        entity: "Payment",
        entityId: payment.id,
        before,
        after: { amount: parsed.data.amount, refundStatus, creditNote },
        ipAddress,
      },
    }),
  ]);
  return NextResponse.json({
    status: refundStatus,
    creditNoteNumber: creditNote,
  });
}

export async function PATCH(request: Request) {
  const access = await authorizeAdminApi("payments");
  if (!access.user || access.user.role !== "ADMIN")
    return NextResponse.json(
      { error: "ADMIN payment permission required." },
      { status: 403 },
    );
  const parsed = z
    .object({ paymentId: z.string().min(1) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid payment ID." }, { status: 400 });
  const payment = await prisma.payment.findUnique({
    where: { id: parsed.data.paymentId },
    select: { id: true, proofUrl: true, provider: true, status: true },
  });
  if (!payment || payment.provider !== "MANUAL" || !payment.proofUrl)
    return NextResponse.json({ error: "Proof not found." }, { status: 404 });
  try {
    const data = await readFile(
      path.join(
        process.cwd(),
        "private",
        "bank-proofs",
        path.basename(payment.proofUrl),
      ),
    );
    return new Response(data, {
      headers: {
        "Content-Type": payment.proofUrl.endsWith(".pdf")
          ? "application/pdf"
          : "image/webp",
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Stored proof file is unavailable." },
      { status: 404 },
    );
  }
}
