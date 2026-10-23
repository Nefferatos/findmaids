import { AdPlacementType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/email";
import { storeInvoicePdf } from "./invoices";
import type { VerifiedWebhook } from "./provider";
import { reserveWebhookEvent } from "./domain";

export async function processPaymentWebhook(
  event: VerifiedWebhook,
  providerName = "PAYMONGO",
) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.paymentWebhookEvent.create({
        data: {
          provider: providerName,
          eventId: event.eventId,
          eventType: event.type,
        },
      });
      const payment = await tx.payment.findFirst({
        where: {
          OR: [
            { id: event.paymentReference },
            { checkoutRef: event.paymentReference },
            { providerRef: event.paymentReference },
          ],
        },
        include: { subscription: { include: { agency: true, plan: true } } },
      });
      if (!payment) throw new Error("Payment reference not found.");
      if (event.status === "failed" || event.status === "expired") {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: event.status === "expired" ? "EXPIRED" : "FAILED" },
        });
        if (payment.subscription.status === "ACTIVE") {
          const graceEndsAt = new Date(Date.now() + 3 * 86_400_000);
          await tx.subscription.update({
            where: { id: payment.subscriptionId },
            data: { status: "PAST_DUE", graceEndsAt },
          });
        }
        if (payment.subscription.status === "PENDING") {
          await tx.subscription.update({
            where: { id: payment.subscriptionId },
            data: { status: "CANCELLED" },
          });
        }
        await tx.auditLog.create({
          data: {
            agencyId: payment.subscription.agencyId,
            action: `PAYMENT_${event.status.toUpperCase()}`,
            entity: "Payment",
            entityId: payment.id,
            metadata: { eventId: event.eventId },
          },
        });
        return { duplicate: false, paid: false, payment };
      }
      const paidAt = new Date();
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "PAID",
          paidAt,
          ...(providerName === "PAYMONGO" && event.providerTransactionId
            ? { providerRef: event.providerTransactionId }
            : {}),
        },
      });
      await tx.subscription.updateMany({
        where: {
          agencyId: payment.subscription.agencyId,
          status: { in: ["ACTIVE", "PAST_DUE"] },
          id: { not: payment.subscriptionId },
        },
        data: { status: "EXPIRED" },
      });
      const endDate =
        payment.prorated && payment.subscription.endDate
          ? payment.subscription.endDate
          : new Date(paidAt);
      if (!(payment.prorated && payment.subscription.endDate)) {
        if (payment.billingPeriod === "YEARLY")
          endDate.setUTCFullYear(endDate.getUTCFullYear() + 1);
        else endDate.setUTCMonth(endDate.getUTCMonth() + 1);
      }
      await tx.subscription.update({
        where: { id: payment.subscriptionId },
        data: {
          status: "ACTIVE",
          startDate: paidAt,
          endDate,
          graceEndsAt: null,
        },
      });
      await tx.adPlacement.updateMany({
        where: { agencyId: payment.subscription.agencyId, status: "ACTIVE" },
        data: { status: "COMPLETED" },
      });
      const placements: AdPlacementType[] = payment.subscription.plan.name
        .toLowerCase()
        .includes("platinum")
        ? [AdPlacementType.FEATURED, AdPlacementType.HOMEPAGE, AdPlacementType.CATEGORY_TOP]
        : Array.from(
            { length: payment.subscription.plan.featuredSlots },
            () => AdPlacementType.FEATURED,
          );
      for (const type of placements)
        await tx.adPlacement.create({
          data: {
            agencyId: payment.subscription.agencyId,
            type,
            startDate: paidAt,
            endDate,
            status: "ACTIVE",
          },
        });
      await tx.auditLog.create({
        data: {
          agencyId: payment.subscription.agencyId,
          action: "PAYMENT_PAID",
          entity: "Payment",
          entityId: payment.id,
          metadata: {
            eventId: event.eventId,
            planId: payment.subscription.planId,
          },
        },
      });
      return {
        duplicate: false,
        paid: true,
        payment: { ...payment, paidAt, status: "PAID" as const },
      };
    });
    if (result.paid) {
      try {
        const receiptUrl = await storeInvoicePdf({
          paymentId: result.payment.id,
          invoiceNumber: result.payment.invoiceNumber,
          agencyName: result.payment.subscription.agency.name,
          amount: Number(result.payment.amount),
          currency: result.payment.currency,
          paidAt: result.payment.paidAt!,
        });
        await prisma.payment.update({
          where: { id: result.payment.id },
          data: { invoiceUrl: receiptUrl },
        });
        await sendEmail(
          result.payment.subscription.agency.email,
          `FindMaids payment receipt ${result.payment.invoiceNumber}`,
          `Your payment was received. Invoice ${result.payment.invoiceNumber}: ${new URL(receiptUrl, process.env.NEXTAUTH_URL ?? "http://localhost:3000")}`,
        );
      } catch (error) {
        logger.error({ paymentId: result.payment.id, errorType: error instanceof Error ? error.name : "unknown" }, "Payment is recorded; invoice/email delivery needs retry");
      }
    }
    return result;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return { duplicate: true, paid: false };
    throw error;
  }
}

export function processWebhookIdempotently<T>(
  seenEventIds: Set<string>,
  eventId: string,
  process: () => T,
): T | null {
  if (!reserveWebhookEvent(seenEventIds, eventId)) return null;
  return process();
}
