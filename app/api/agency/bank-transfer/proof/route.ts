import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
const schema = z.object({ paymentId: z.string().min(1) });
const accepted = new Map([["image/jpeg", ".jpg"], ["image/png", ".png"], ["image/webp", ".webp"], ["application/pdf", ".pdf"]]);

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "AGENCY") return NextResponse.json({ error: "Agency access required." }, { status: 401 });
  if (!(await checkRateLimit(`bank-proof:${session.user.id}`, 5, 86_400)).allowed) return NextResponse.json({ error: "Proof upload limit reached." }, { status: 429 });
  const form = await request.formData().catch(() => null);
  const parsed = schema.safeParse({ paymentId: form?.get("paymentId") });
  const file = form?.get("file");
  if (!parsed.success || !(file instanceof File)) return NextResponse.json({ error: "Payment and proof file are required." }, { status: 400 });
  if (file.size < 1 || file.size > 8 * 1024 * 1024 || !accepted.has(file.type)) return NextResponse.json({ error: "Upload JPG, PNG, WebP, or PDF up to 8 MB." }, { status: 415 });
  const payment = await prisma.payment.findFirst({ where: { id: parsed.data.paymentId, status: "PENDING_BANK_TRANSFER", provider: "MANUAL", subscription: { agency: { ownerId: session.user.id } } }, select: { id: true, expiresAt: true } });
  if (!payment || payment.expiresAt && payment.expiresAt < new Date()) return NextResponse.json({ error: "Pending bank payment was not found or has expired." }, { status: 404 });
  const extension = accepted.get(file.type)!;
  const filename = `${randomUUID()}${extension}`;
  const directory = path.join(process.cwd(), "private", "bank-proofs");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, filename), Buffer.from(await file.arrayBuffer()), { flag: "wx", mode: 0o600 });
  await prisma.payment.update({ where: { id: payment.id }, data: { proofUrl: filename } });
  return NextResponse.json({ uploaded: true }, { status: 201 });
}