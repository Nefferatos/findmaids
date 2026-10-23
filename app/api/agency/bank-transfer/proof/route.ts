import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { storeObject } from "@/lib/storage";

export const runtime = "nodejs";
const schema = z.object({ paymentId: z.string().min(1) });
const accepted = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

function matchesDeclaredType(bytes: Uint8Array, mime: string) {
  if (mime === "image/jpeg")
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png")
    return bytes
      .subarray(0, 8)
      .every(
        (byte, index) => byte === [137, 80, 78, 71, 13, 10, 26, 10][index],
      );
  if (mime === "image/webp")
    return (
      Buffer.from(bytes.subarray(0, 4)).toString() === "RIFF" &&
      Buffer.from(bytes.subarray(8, 12)).toString() === "WEBP"
    );
  if (mime === "application/pdf")
    return Buffer.from(bytes.subarray(0, 5)).toString() === "%PDF-";
  return false;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "AGENCY")
    return NextResponse.json(
      { error: "Agency access required." },
      { status: 401 },
    );
  if (
    !(await checkRateLimit(`bank-proof:${session.user.id}`, 5, 86_400)).allowed
  )
    return NextResponse.json(
      { error: "Proof upload limit reached." },
      { status: 429 },
    );
  const form = await request.formData().catch(() => null);
  const parsed = schema.safeParse({ paymentId: form?.get("paymentId") });
  const file = form?.get("file");
  if (!parsed.success || !(file instanceof File))
    return NextResponse.json(
      { error: "Payment and proof file are required." },
      { status: 400 },
    );
  if (file.size < 1 || file.size > 8 * 1024 * 1024 || !accepted.has(file.type))
    return NextResponse.json(
      { error: "Upload JPG, PNG, WebP, or PDF up to 8 MB." },
      { status: 415 },
    );
  const payment = await prisma.payment.findFirst({
    where: {
      id: parsed.data.paymentId,
      status: "PENDING_BANK_TRANSFER",
      provider: "MANUAL",
      subscription: { agency: { ownerId: session.user.id } },
    },
    select: { id: true, expiresAt: true },
  });
  if (!payment || (payment.expiresAt && payment.expiresAt < new Date()))
    return NextResponse.json(
      { error: "Pending bank payment was not found or has expired." },
      { status: 404 },
    );
  const input = new Uint8Array(await file.arrayBuffer());
  if (!matchesDeclaredType(input, file.type))
    return NextResponse.json(
      { error: "The proof content does not match its file type." },
      { status: 415 },
    );
  let body = input;
  let contentType = file.type;
  const extension = file.type === "application/pdf" ? ".pdf" : ".webp";
  if (file.type !== "application/pdf") {
    try {
      body = await sharp(input, {
        limitInputPixels: 40_000_000,
        failOn: "error",
      })
        .rotate()
        .resize({
          width: 2400,
          height: 2400,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer();
      contentType = "image/webp";
    } catch {
      return NextResponse.json(
        { error: "The proof image could not be decoded." },
        { status: 415 },
      );
    }
  }
  const filename = `${randomUUID()}${extension}`;
  const objectKey = `bank-proofs/${payment.id}/${filename}`;
  await storeObject({
    bucket: "private",
    key: objectKey,
    body,
    contentType,
  });
  await prisma.payment.update({
    where: { id: payment.id },
    data: { proofUrl: objectKey },
  });
  return NextResponse.json({ uploaded: true }, { status: 201 });
}
