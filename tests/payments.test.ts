import { describe, expect, it } from "vitest";
import {
  calculateProration,
  checkLeadLimit,
  invoiceNumber,
  transitionSubscription,
} from "@/lib/payments/domain";
import { agencyScopedWhere } from "@/lib/tenant";
import { MockProvider } from "@/lib/payments/provider";
import { processWebhookIdempotently } from "@/lib/payments/service";

describe("payment domain", () => {
  it("allows valid subscription transitions and rejects invalid ones", () => {
    expect(transitionSubscription("PENDING", "ACTIVE")).toBe("ACTIVE");
    expect(transitionSubscription("PAST_DUE", "EXPIRED")).toBe("EXPIRED");
    expect(() => transitionSubscription("EXPIRED", "PAST_DUE")).toThrow(
      "Invalid subscription transition",
    );
  });

  it("prorates only an immediate upgrade over the remaining period", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const end = new Date("2026-01-31T00:00:00Z");
    const midpoint = new Date("2026-01-16T00:00:00Z");
    expect(calculateProration(1000, 2000, start, end, midpoint)).toBe(500);
    expect(calculateProration(2000, 1000, start, end, midpoint)).toBe(0);
  });

  it("formats annual invoice sequence values with six digits", () => {
    expect(invoiceNumber(2026, 123)).toBe("FM-2026-000123");
  });

  it("checks lead limits without silently allowing overage", () => {
    expect(checkLeadLimit(10, 9)).toEqual({ allowed: true, remaining: 1 });
    expect(checkLeadLimit(10, 10)).toEqual({ allowed: false, remaining: 0 });
    expect(checkLeadLimit(null, 100)).toEqual({
      allowed: true,
      remaining: null,
    });
  });

  it("always constrains agency-owned queries to the authenticated tenant", () => {
    expect(agencyScopedWhere("agency-a", { status: "NEW" })).toEqual({
      agencyId: "agency-a",
      status: "NEW",
    });
    expect(
      agencyScopedWhere("agency-a", {
        id: "lead-from-b",
        agencyId: "agency-b",
      }),
    ).toEqual({ agencyId: "agency-a", id: "lead-from-b" });
  });

  it("mock checkout and signed event contract are deterministic for tests", async () => {
    const provider = new MockProvider();
    await expect(
      provider.createCheckout({
        paymentId: "payment-1",
        amountPhp: 999,
        description: "Gold",
        customerEmail: "agency@example.test",
        successUrl: "https://local.test/success",
        cancelUrl: "https://local.test/cancel",
      }),
    ).resolves.toMatchObject({
      checkoutId: "mock-payment-1",
      checkoutUrl: expect.stringContaining("mockPayment=payment-1"),
    });
    process.env.PAYMENT_WEBHOOK_SECRET = "mock-secret";
    const event = {
      eventId: "event-1",
      type: "payment.paid",
      paymentReference: "payment-1",
      status: "paid" as const,
    };
    expect(
      provider.verifyWebhook(JSON.stringify(event), "mock-secret"),
    ).toEqual(event);
    expect(() =>
      provider.verifyWebhook(JSON.stringify(event), "bad-secret"),
    ).toThrow("Invalid mock webhook signature");
  });

  it("does not process a webhook event ID twice", () => {
    const ids = new Set<string>();
    let count = 0;
    expect(processWebhookIdempotently(ids, "event-a", () => ++count)).toBe(1);
    expect(
      processWebhookIdempotently(ids, "event-a", () => ++count),
    ).toBeNull();
    expect(count).toBe(1);
  });
});
