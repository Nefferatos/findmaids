import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  chatCookieName,
  hashVisitorToken,
  verifyVisitorCookie,
} from "@/lib/ai/chat-session";

export async function POST(request: Request) {
  const parsed = z
    .object({
      messageId: z.string().min(1),
      rating: z.number().int().min(1).max(5),
      comment: z.string().max(500).optional(),
    })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid feedback." }, { status: 400 });
  const jar = await cookies();
  const token = verifyVisitorCookie(jar.get(chatCookieName)?.value);
  if (!token)
    return NextResponse.json(
      { error: "Conversation access required." },
      { status: 401 },
    );
  const hash = hashVisitorToken(token);
  const message = await prisma.message.findFirst({
    where: {
      id: parsed.data.messageId,
      role: "ASSISTANT",
      conversation: { visitorTokenHash: hash },
    },
    select: { id: true },
  });
  if (!message)
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  await prisma.aiFeedback.upsert({
    where: { messageId: message.id },
    create: {
      messageId: message.id,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
    },
    update: { rating: parsed.data.rating, comment: parsed.data.comment },
  });
  return NextResponse.json({ saved: true });
}
