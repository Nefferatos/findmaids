import { NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payments/provider";
import { processPaymentWebhook } from "@/lib/payments/service";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? "unavailable";
  const rawBody = await request.text();
  let event;
  let providerName = "";
  try {
    const provider = getPaymentProvider();
    event = provider.verifyWebhook(
      rawBody,
      request.headers.get("paymongo-signature") ?? "",
    );
    providerName = provider.name;
  } catch (error) {
    logger.warn(
      { requestId, errorType: error instanceof Error ? error.name : "unknown" },
      "Payment webhook signature rejected",
    );
    return NextResponse.json(
      { error: "Invalid webhook signature." },
      { status: 400 },
    );
  }
  try {
    const result = await processPaymentWebhook(event, providerName);
    logger.info(
      {
        requestId,
        provider: providerName,
        duplicate: result.duplicate,
        paid: result.paid,
      },
      "Payment webhook processed",
    );
    return NextResponse.json({
      received: true,
      duplicate: result.duplicate,
      paid: result.paid,
    });
  } catch (error) {
    logger.error(
      { requestId, errorType: error instanceof Error ? error.name : "unknown" },
      "Payment webhook processing failed",
    );
    return NextResponse.json(
      { error: "Payment event could not be processed." },
      { status: 500 },
    );
  }
}
