import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { agencyScopedWhere } from "@/lib/tenant";

const schema = z.object({
  reviewId: z.string().min(1),
  reply: z.string().trim().min(3).max(2000),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "AGENCY")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Enter a reply between 3 and 2,000 characters." },
      { status: 400 },
    );
  const agency = await prisma.agency.findUnique({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!agency)
    return NextResponse.json({ error: "Agency not found." }, { status: 404 });
  const updated = await prisma.review.updateMany({
    where: agencyScopedWhere(agency.id, {
      id: parsed.data.reviewId,
      status: "PUBLISHED",
    }),
    data: { agencyReply: parsed.data.reply, agencyRepliedAt: new Date() },
  });
  return updated.count
    ? NextResponse.json({ replied: true })
    : NextResponse.json(
        { error: "Published review not found." },
        { status: 404 },
      );
}
