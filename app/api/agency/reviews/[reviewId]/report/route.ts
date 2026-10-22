import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ reason: z.string().trim().min(10).max(1000) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reviewId: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "AGENCY")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { reviewId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Please provide a report reason." },
      { status: 400 },
    );
  const agency = await prisma.agency.findUnique({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!agency)
    return NextResponse.json({ error: "Agency not found." }, { status: 404 });
  const updated = await prisma.review.updateMany({
    where: { id: reviewId, agencyId: agency.id, status: "PUBLISHED" },
    data: { reportedAt: new Date(), reportReason: parsed.data.reason },
  });
  return updated.count
    ? NextResponse.json({ reported: true })
    : NextResponse.json(
        { error: "Published review not found." },
        { status: 404 },
      );
}
