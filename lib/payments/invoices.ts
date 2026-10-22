import PDFDocument from "pdfkit";
import type { Prisma } from "@prisma/client";
import { invoiceNumber } from "./domain";
import { storeObject } from "@/lib/storage";

export async function reserveInvoiceNumber(
  tx: Prisma.TransactionClient,
  date = new Date(),
) {
  const year = date.getUTCFullYear();
  const rows = await tx.$queryRaw<Array<{ lastValue: number }>>`
    INSERT INTO "InvoiceSequence" ("year", "lastValue", "createdAt", "updatedAt")
    VALUES (${year}, 1, NOW(), NOW())
    ON CONFLICT ("year") DO UPDATE SET "lastValue" = "InvoiceSequence"."lastValue" + 1, "updatedAt" = NOW()
    RETURNING "lastValue"
  `;
  return invoiceNumber(year, rows[0].lastValue);
}

export async function storeInvoicePdf(input: {
  paymentId: string;
  invoiceNumber: string;
  agencyName: string;
  amount: number;
  currency: string;
  paidAt: Date;
}) {
  const chunks: Buffer[] = [];
  const document = new PDFDocument({
    size: "A4",
    margin: 56,
    info: {
      Title: `FindMaids invoice ${input.invoiceNumber}`,
      Author: "FindMaids",
    },
  });
  document.on("data", (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve, reject) => {
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });
  document
    .fontSize(24)
    .fillColor("#176b4d")
    .text("FindMaids", { align: "left" });
  document.moveDown().fillColor("#173328").fontSize(18).text("Payment receipt");
  document.moveDown().fontSize(12).text(`Invoice: ${input.invoiceNumber}`);
  document.text(`Agency: ${input.agencyName}`);
  document.text(`Paid: ${input.paidAt.toISOString()}`);
  const netAmount = Math.round((input.amount / 1.12) * 100) / 100;
  const vatAmount = Math.round((input.amount - netAmount) * 100) / 100;
  document
    .moveDown()
    .fontSize(12)
    .text(`Net amount: ${input.currency} ${netAmount.toFixed(2)}`);
  document.text(
    `VAT included (12%): ${input.currency} ${vatAmount.toFixed(2)}`,
  );
  document
    .moveDown()
    .fontSize(16)
    .text(`Amount paid: ${input.currency} ${input.amount.toFixed(2)}`);
  document
    .moveDown()
    .fontSize(10)
    .fillColor("#52665a")
    .text(
      "This receipt confirms payment for FindMaids directory services. It is not a tax invoice unless separately identified as such.",
    );
  document.end();
  const buffer = await finished;
  await storeObject({
    bucket: "private",
    key: `invoices/${input.paymentId}.pdf`,
    body: buffer,
    contentType: "application/pdf",
  });
  return `/api/agency/invoices/${input.paymentId}`;
}
