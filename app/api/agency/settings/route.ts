import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ leadEmails: z.boolean() });

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "AGENCY")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid notification preferences." },
      { status: 400 },
    );
  await prisma.user.update({
    where: { id: session.user.id },
    data: { notificationPreferences: { leadEmails: parsed.data.leadEmails } },
  });
  return NextResponse.json({ saved: true });
}
