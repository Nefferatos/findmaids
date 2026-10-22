import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { storeInvoicePdf } from "@/lib/payments/invoices";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "AGENCY")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { paymentId } = await params;
  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      status: "PAID",
      subscription: { agency: { ownerId: session.user.id } },
    },
    include: { subscription: { include: { agency: true } } },
  });
  if (!payment)
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  const url =
    payment.invoiceUrl ??
    (await storeInvoicePdf({
      paymentId: payment.id,
      invoiceNumber: payment.invoiceNumber,
      agencyName: payment.subscription.agency.name,
      amount: Number(payment.amount),
      currency: payment.currency,
      paidAt: payment.paidAt ?? payment.createdAt,
    }));
  if (!payment.invoiceUrl)
    await prisma.payment.update({
      where: { id: payment.id },
      data: { invoiceUrl: url },
    });
  const filepath = path.join(
    process.cwd(),
    "private",
    "invoices",
    `${payment.id}.pdf`,
  );
  const pdf = await readFile(filepath);
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${payment.invoiceNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
