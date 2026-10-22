import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { agencyScopedWhere } from "@/lib/tenant";

const schema = z.object({
  reviewId: z.string().min(1),
  reason: z.string().trim().min(10).max(1000),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "AGENCY")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Provide a reason for the report." },
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
    data: { reportedAt: new Date(), reportReason: parsed.data.reason },
  });
  return updated.count
    ? NextResponse.json({ reported: true })
    : NextResponse.json({ error: "Review not found." }, { status: 404 });
}
