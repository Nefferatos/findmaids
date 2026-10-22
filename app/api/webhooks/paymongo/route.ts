import { NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payments/provider";
import { processPaymentWebhook } from "@/lib/payments/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
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
    console.error(
      "Payment webhook signature rejected",
      error instanceof Error ? error.message : "verification error",
    );
    return NextResponse.json(
      { error: "Invalid webhook signature." },
      { status: 400 },
    );
  }
  try {
    const result = await processPaymentWebhook(event, providerName);
    return NextResponse.json({
      received: true,
      duplicate: result.duplicate,
      paid: result.paid,
    });
  } catch (error) {
    console.error(
      "Payment webhook processing failed",
      error instanceof Error ? error.message : "processing error",
    );
    return NextResponse.json(
      { error: "Payment event could not be processed." },
      { status: 500 },
    );
  }
}
