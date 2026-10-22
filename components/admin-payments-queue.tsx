"use client";

import { useState } from "react";

type Payment = {
  id: string;
  invoiceNumber: string;
  referenceCode: string | null;
  bankReference: string | null;
  bankNotes: string | null;
  proofUrl: string | null;
  amount: string | number;
  receivedAmount: string | number | null;
  refundAmount: string | number | null;
  currency: string;
  provider: string;
  status: string;
  expiresAt: string | null;
  createdAt: string;
  subscription: {
    agency: { name: string; email: string };
    plan: { name: string };
  };
};

export function AdminPaymentsQueue({
  initialPayments,
}: {
  initialPayments: Payment[];
}) {
  const [payments, setPayments] = useState(initialPayments);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("PENDING_BANK_TRANSFER");

  async function act(
    payment: Payment,
    body: Record<string, unknown>,
    confirmMessage: string,
  ) {
    if (!window.confirm(confirmMessage)) return;
    const response = await fetch("/api/admin/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId: payment.id, ...body }),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Payment action failed.");
      return;
    }
    setMessage(`Payment updated: ${result.status ?? "completed"}.`);
    if (body.action === "refund" && result.status === "PAID") {
      const refundedAmount =
        Number(payment.refundAmount ?? 0) + Number(body.amount);
      setPayments((items) =>
        items.map((item) =>
          item.id === payment.id
            ? { ...item, refundAmount: refundedAmount }
            : item,
        ),
      );
    } else {
      setPayments((items) => items.filter((item) => item.id !== payment.id));
    }
  }

  const visible = payments.filter(
    (payment) => filter === "ALL" || payment.status === filter,
  );
  return (
    <section className="rounded-md border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div>
          <h2 className="font-display text-xl font-bold">
            Payment reconciliation
          </h2>
          <p className="text-muted-foreground text-sm">
            Manual bank transfers and payment audit.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            aria-label="Payment status filter"
            className="min-h-10 rounded border px-2"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="PENDING_BANK_TRANSFER">Pending bank transfer</option>
            <option value="PARTIAL">Partial</option>
            <option value="PAID">Paid / refund</option>
            <option value="ALL">All loaded</option>
          </select>
          <a
            className="inline-flex min-h-10 items-center rounded border px-3 text-sm font-semibold"
            href="/api/admin/payments?format=csv"
          >
            Export CSV
          </a>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="bg-[#f7f7f0]">
            <tr>
              <th className="p-3">Agency / Plan</th>
              <th className="p-3">Reference</th>
              <th className="p-3">Expected</th>
              <th className="p-3">Proof / notes</th>
              <th className="p-3">Expiry</th>
              <th className="p-3">Reconcile</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((payment) => (
              <tr key={payment.id} className="border-t align-top">
                <td className="p-3">
                  <strong>{payment.subscription.agency.name}</strong>
                  <span className="mt-1 block">
                    {payment.subscription.plan.name}
                  </span>
                  <span className="text-muted-foreground mt-1 block text-xs">
                    {payment.subscription.agency.email}
                  </span>
                  <span className="mt-1 block text-xs">
                    {payment.invoiceNumber}
                  </span>
                </td>
                <td className="p-3">
                  <strong>{payment.referenceCode ?? "—"}</strong>
                  <span className="text-muted-foreground mt-1 block text-xs">
                    Bank: {payment.bankReference ?? "not entered"}
                  </span>
                </td>
                <td className="p-3">
                  {payment.currency}{" "}
                  {Number(payment.amount).toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                  })}
                  {payment.receivedAmount != null && (
                    <span className="mt-1 block">
                      Received {Number(payment.receivedAmount).toFixed(2)}
                    </span>
                  )}
                </td>
                <td className="p-3">
                  {payment.proofUrl && (
                    <a
                      className="text-primary font-semibold underline"
                      href={`/api/admin/payments?proof=${payment.id}`}
                      target="_blank"
                    >
                      View proof
                    </a>
                  )}
                  <p className="mt-2 max-w-56 text-xs whitespace-pre-wrap">
                    {payment.bankNotes}
                  </p>
                </td>
                <td className="p-3">
                  {payment.expiresAt
                    ? new Date(payment.expiresAt).toLocaleString("en-PH")
                    : "—"}
                </td>
                <td className="space-y-2 p-3">
                  {payment.status === "PAID" ? (
                    <>
                      <label className="block text-xs font-semibold">
                        Refund amount PHP
                        <input
                          aria-label={`Refund amount for ${payment.invoiceNumber}`}
                          id={`refund-${payment.id}`}
                          type="number"
                          min="0.01"
                          max={
                            Number(payment.amount) -
                            Number(payment.refundAmount ?? 0)
                          }
                          step="0.01"
                          defaultValue={
                            Number(payment.amount) -
                            Number(payment.refundAmount ?? 0)
                          }
                          className="mt-1 min-h-9 w-36 rounded border px-2"
                        />
                      </label>
                      <label className="block text-xs font-semibold">
                        Refund reason
                        <textarea
                          aria-label={`Refund reason for ${payment.invoiceNumber}`}
                          id={`refund-reason-${payment.id}`}
                          className="mt-1 min-h-16 w-52 rounded border p-2"
                        />
                      </label>
                      <button
                        className="min-h-9 rounded border border-red-700 px-3 text-xs font-semibold text-red-800"
                        onClick={() => {
                          const amount = Number(
                            (
                              document.getElementById(
                                `refund-${payment.id}`,
                              ) as HTMLInputElement
                            ).value,
                          );
                          const reason = (
                            document.getElementById(
                              `refund-reason-${payment.id}`,
                            ) as HTMLTextAreaElement
                          ).value;
                          void act(
                            payment,
                            {
                              action: "refund",
                              confirmed: true,
                              amount,
                              reason,
                            },
                            `Issue a case-by-case refund of PHP ${amount.toFixed(2)} for ${payment.invoiceNumber}? This cannot be automatically reversed.`,
                          );
                        }}
                      >
                        Confirm refund
                      </button>
                    </>
                  ) : (
                    <>
                      <label className="block text-xs font-semibold">
                        Cumulative received PHP
                        <input
                          aria-label={`Received amount for ${payment.invoiceNumber}`}
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={payment.amount}
                          id={`amount-${payment.id}`}
                          className="mt-1 min-h-9 w-36 rounded border px-2"
                        />
                      </label>
                      <label className="block text-xs font-semibold">
                        Bank reference
                        <input
                          aria-label={`Bank reference for ${payment.invoiceNumber}`}
                          id={`bankref-${payment.id}`}
                          defaultValue={payment.bankReference ?? ""}
                          className="mt-1 min-h-9 w-36 rounded border px-2"
                        />
                      </label>
                      <label className="block text-xs font-semibold">
                        Received date
                        <input
                          aria-label={`Received date for ${payment.invoiceNumber}`}
                          id={`date-${payment.id}`}
                          type="datetime-local"
                          className="mt-1 min-h-9 w-48 rounded border px-2"
                        />
                      </label>
                      <button
                        className="bg-primary min-h-9 rounded px-3 text-xs font-bold text-white"
                        onClick={() => {
                          const amount = Number(
                            (
                              document.getElementById(
                                `amount-${payment.id}`,
                              ) as HTMLInputElement
                            ).value,
                          );
                          const bankReference = (
                            document.getElementById(
                              `bankref-${payment.id}`,
                            ) as HTMLInputElement
                          ).value;
                          const dateValue = (
                            document.getElementById(
                              `date-${payment.id}`,
                            ) as HTMLInputElement
                          ).value;
                          void act(
                            payment,
                            {
                              action: "mark_paid",
                              receivedAmount: amount,
                              bankReference,
                              receivedAt: dateValue
                                ? new Date(dateValue).toISOString()
                                : new Date().toISOString(),
                            },
                            `Mark ${payment.invoiceNumber} paid with cumulative received amount PHP ${amount.toFixed(2)}? This activates the plan.`,
                          );
                        }}
                      >
                        Mark paid
                      </button>
                      <button
                        className="ml-2 min-h-9 rounded border px-3 text-xs font-semibold"
                        onClick={() => {
                          const amount = Number(
                            (
                              document.getElementById(
                                `amount-${payment.id}`,
                              ) as HTMLInputElement
                            ).value,
                          );
                          const bankReference = (
                            document.getElementById(
                              `bankref-${payment.id}`,
                            ) as HTMLInputElement
                          ).value;
                          void act(
                            payment,
                            {
                              action: "partial",
                              receivedAmount: amount,
                              bankReference,
                              receivedAt: new Date().toISOString(),
                              note: "Partial receipt; awaiting balance.",
                            },
                            `Record partial payment of PHP ${amount.toFixed(2)}?`,
                          );
                        }}
                      >
                        Partial
                      </button>
                      <button
                        className="mt-2 block min-h-9 rounded border border-red-700 px-3 text-xs font-semibold text-red-800"
                        onClick={() =>
                          void act(
                            payment,
                            {
                              action: "reject",
                              reason:
                                "Rejected by admin during reconciliation.",
                            },
                            `Reject ${payment.invoiceNumber}?`,
                          )
                        }
                      >
                        Reject
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className="text-muted-foreground p-8 text-center">
            No payments in this queue.
          </p>
        )}
      </div>
      {message && (
        <p role="status" className="text-primary border-t p-3 text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
