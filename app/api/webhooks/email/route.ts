import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { maskPii } from "@/lib/ai/guardrails";
import { isFeatureEnabled } from "@/lib/ai/flags";

const schema = z.object({
  providerMessageId: z.string().min(1).max(200),
  conversationId: z.string().min(1),
  message: z.string().trim().min(1).max(3000),
  direction: z.literal("inbound"),
});
function verify(raw: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  const received = Buffer.from(signature.replace(/^sha256=/, ""), "hex");
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}
export async function POST(request: Request) {
  if (!(await isFeatureEnabled("email_inbound")))
    return NextResponse.json(
      { error: "Email integration is disabled." },
      { status: 404 },
    );
  const secret = process.env.EMAIL_WEBHOOK_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: "Webhook is not configured." },
      { status: 503 },
    );
  const raw = await request.text();
  if (!verify(raw, request.headers.get("x-provider-signature"), secret))
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid webhook event." },
      { status: 400 },
    );
  const conversation = await prisma.conversation.findUnique({
    where: { id: parsed.data.conversationId },
    select: { id: true, channel: true },
  });
  if (!conversation || conversation.channel !== "EMAIL")
    return NextResponse.json(
      { error: "Conversation not found." },
      { status: 404 },
    );
  const message = await prisma.message.upsert({
    where: { providerMessageId: `email:${parsed.data.providerMessageId}` },
    create: {
      providerMessageId: `email:${parsed.data.providerMessageId}`,
      conversationId: conversation.id,
      role: "USER",
      content: maskPii(parsed.data.message),
    },
    update: {},
  });
  return NextResponse.json({ accepted: true, messageId: message.id });
}
