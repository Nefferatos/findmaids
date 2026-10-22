import { describe, expect, it } from "vitest";
import { classifyBankPayment, calculateRefund, paymentStatusAfterReconciliation, transitionAgencyStatus } from "@/lib/admin-workflows";

describe("admin approval transitions", () => {
  it("supports request-changes/resubmit/approve and rejects invalid transitions", () => {
    expect(transitionAgencyStatus("PENDING", "NEEDS_CHANGES")).toBe("NEEDS_CHANGES");
    expect(transitionAgencyStatus("NEEDS_CHANGES", "PENDING")).toBe("PENDING");
    expect(transitionAgencyStatus("PENDING", "APPROVED")).toBe("APPROVED");
    expect(() => transitionAgencyStatus("REJECTED", "APPROVED")).toThrow("Invalid agency transition");
  });
});

describe("manual bank reconciliation", () => {
  const future = new Date("2030-01-05T00:00:00Z");
  it("classifies exact, partial, mismatch, duplicate and expired transfers", () => {
    expect(classifyBankPayment({ expected: 1000, received: 1000, reference: "BANK-1", duplicateReference: false, expiresAt: future })).toBe("EXACT");
    expect(classifyBankPayment({ expected: 1000, received: 500, reference: "BANK-2", duplicateReference: false, expiresAt: future })).toBe("PARTIAL");
    expect(classifyBankPayment({ expected: 1000, received: 1200, reference: "BANK-3", duplicateReference: false, expiresAt: future })).toBe("MISMATCH");
    expect(classifyBankPayment({ expected: 1000, received: 1000, reference: "BANK-4", duplicateReference: true, expiresAt: future })).toBe("DUPLICATE_REFERENCE");
    expect(classifyBankPayment({ expected: 1000, received: 1000, reference: "BANK-5", duplicateReference: false, expiresAt: new Date("2020-01-01"), now: new Date("2020-01-02") })).toBe("EXPIRED");
    expect(paymentStatusAfterReconciliation("PARTIAL")).toBe("PARTIAL");
  });
});

describe("manual-case refund policy", () => {
  it("requires explicit confirmation and never exceeds the remaining balance", () => {
    expect(calculateRefund(20, 100, 30, true)).toEqual({ refunded: 50, fullyRefunded: false, remaining: 50 });
    expect(calculateRefund(0, 100, 100, true).fullyRefunded).toBe(true);
    expect(() => calculateRefund(0, 100, 10, false)).toThrow("explicit ADMIN confirmation");
    expect(() => calculateRefund(90, 100, 11, true)).toThrow("exceeds");
  });
});