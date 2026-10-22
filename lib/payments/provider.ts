import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const mockEventSchema = z.object({
  eventId: z.string().min(1),
  type: z.string().min(1),
  paymentReference: z.string().min(1),
  status: z.enum(["paid", "failed", "expired"]),
});
const payMongoEventSchema = z
  .object({
    data: z
      .object({
        id: z.string().min(1),
        attributes: z
          .object({
            type: z.string().min(1),
            reference_number: z.string().min(1).optional(),
            data: z
              .object({
                attributes: z
                  .object({ reference_number: z.string().min(1).optional() })
                  .passthrough(),
              })
              .passthrough()
              .optional(),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough();

export type CheckoutInput = {
  paymentId: string;
  amountPhp: number;
  description: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
};
export type CheckoutResult = { checkoutId: string; checkoutUrl: string };
export type VerifiedWebhook = {
  eventId: string;
  type: string;
  paymentReference: string;
  status: "paid" | "failed" | "expired";
};

export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  verifyWebhook(rawBody: string, signature: string): VerifiedWebhook;
  refund(
    providerReference: string,
    amountPhp?: number,
  ): Promise<{ refundId: string }>;
}

export class MockProvider implements PaymentProvider {
  readonly name = "MOCK";

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const checkoutUrl = new URL(input.successUrl);
    checkoutUrl.searchParams.set("mockPayment", input.paymentId);
    return {
      checkoutId: `mock-${input.paymentId}`,
      checkoutUrl: checkoutUrl.toString(),
    };
  }

  verifyWebhook(rawBody: string, signature: string): VerifiedWebhook {
    if (process.env.NODE_ENV === "production")
      throw new Error("Mock provider webhooks are disabled in production.");
    const parsed = mockEventSchema.parse(JSON.parse(rawBody));
    const expected = process.env.PAYMENT_WEBHOOK_SECRET;
    if (!expected || signature !== expected)
      throw new Error("Invalid mock webhook signature.");
    return parsed;
  }

  async refund(providerReference: string) {
    return { refundId: `mock-refund-${providerReference}` };
  }
}

export class PayMongoProvider implements PaymentProvider {
  readonly name = "PAYMONGO";
  private readonly secretKey = process.env.PAYMONGO_SECRET_KEY;
  private readonly webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
  private readonly baseUrl = "https://api.paymongo.com/v1";

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    if (!this.secretKey)
      throw new Error("PAYMONGO_SECRET_KEY is not configured.");
    const response = await fetch(`${this.baseUrl}/checkout_sessions`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.secretKey}:`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [
              {
                currency: "PHP",
                amount: Math.round(input.amountPhp * 100),
                name: input.description,
                quantity: 1,
              },
            ],
            payment_method_types: [
              "card",
              "gcash",
              "paymaya",
              "online_banking",
              "dob",
            ],
            success_url: input.successUrl,
            cancel_url: input.cancelUrl,
            description: input.description,
            reference_number: input.paymentId,
            billing: { email: input.customerEmail },
          },
        },
      }),
      cache: "no-store",
    });
    const payload = (await response.json()) as {
      data?: { id?: string; attributes?: { checkout_url?: string } };
      errors?: { detail?: string }[];
    };
    if (
      !response.ok ||
      !payload.data?.id ||
      !payload.data.attributes?.checkout_url
    )
      throw new Error(
        payload.errors?.[0]?.detail ?? "PayMongo checkout creation failed.",
      );
    return {
      checkoutId: payload.data.id,
      checkoutUrl: payload.data.attributes.checkout_url,
    };
  }

  verifyWebhook(rawBody: string, signature: string): VerifiedWebhook {
    if (!this.webhookSecret)
      throw new Error("PAYMONGO_WEBHOOK_SECRET is not configured.");
    const parts = Object.fromEntries(
      signature
        .split(/[;,]/)
        .map((part) => part.trim().split("=", 2) as [string, string]),
    );
    const timestamp = parts.t;
    const signatureHex = parts.te ?? parts.li;
    if (
      !timestamp ||
      !signatureHex ||
      Math.abs(Date.now() / 1000 - Number(timestamp)) > 300
    )
      throw new Error("Invalid or expired PayMongo webhook signature.");
    const expected = createHmac("sha256", this.webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest();
    const received = Buffer.from(signatureHex, "hex");
    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    )
      throw new Error("Invalid PayMongo webhook signature.");
    const event = payMongoEventSchema.parse(JSON.parse(rawBody));
    const type = event.data.attributes.type;
    const reference =
      event.data.attributes.data?.attributes.reference_number ??
      event.data.attributes.reference_number;
    const status = /paid|succeeded/i.test(type)
      ? "paid"
      : /expire/i.test(type)
        ? "expired"
        : /fail|failed/i.test(type)
          ? "failed"
          : null;
    if (!reference || !status)
      throw new Error(
        "PayMongo webhook event type or payment reference is not supported.",
      );
    return {
      eventId: event.data.id,
      type,
      paymentReference: reference,
      status,
    };
  }

  async refund(providerReference: string, amountPhp?: number) {
    if (!this.secretKey)
      throw new Error("PAYMONGO_SECRET_KEY is not configured.");
    const response = await fetch(`${this.baseUrl}/refunds`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.secretKey}:`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          attributes: {
            payment_id: providerReference,
            ...(amountPhp === undefined
              ? {}
              : { amount: Math.round(amountPhp * 100) }),
            reason: "requested_by_customer",
          },
        },
      }),
      cache: "no-store",
    });
    const payload = (await response.json()) as {
      data?: { id?: string };
      errors?: { detail?: string }[];
    };
    if (!response.ok || !payload.data?.id)
      throw new Error(payload.errors?.[0]?.detail ?? "PayMongo refund failed.");
    return { refundId: payload.data.id };
  }
}

export function getPaymentProvider(): PaymentProvider {
  if (process.env.PAYMENT_PROVIDER === "paymongo")
    return new PayMongoProvider();
  if (process.env.PAYMENT_PROVIDER === "mock") {
    if (process.env.NODE_ENV === "production")
      throw new Error("Mock payments are disabled in production.");
    return new MockProvider();
  }
  if (process.env.NODE_ENV !== "production") return new MockProvider();
  throw new Error("Set PAYMENT_PROVIDER=paymongo in production.");
}
