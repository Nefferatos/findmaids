import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { writeAdminAudit, requestIp } from "@/lib/admin-audit";
import { reviewFlags } from "@/lib/moderation";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("publish"), reviewId: z.string().min(1) }),
  z.object({ action: z.literal("reject"), reviewId: z.string().min(1), reason: z.string().trim().min(5).max(1000) }),
  z.object({ action: z.literal("redact"), reviewId: z.string().min(1), body: z.string().trim().min(5).max(3000) }),
  z.object({ action: z.literal("delete"), reviewId: z.string().min(1), reason: z.string().trim().min(5).max(1000) }),
  z.object({ action: z.literal("bulk_publish"), reviewIds: z.array(z.string().min(1)).min(1).max(100) }),
]);

export async function GET(request: Request) {
  const access = await authorizeAdminApi("reviews");
  if (!access.user) return NextResponse.json({ error: "Review moderation permission required." }, { status: access.status });
  const url = new URL(request.url);
  const reported = url.searchParams.get("reported") === "true";
  const reviews = await prisma.review.findMany({
    where: reported ? { reportedAt: { not: null }, status: "PUBLISHED" } : { status: "PENDING" },
    include: { agency: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: "asc" }, take: 300,
  });
  const flagged = await Promise.all(reviews.map(async (review) => ({ ...review, flags: await reviewFlags(review) })));
  return NextResponse.json({ reviews: flagged });
}

export async function POST(request: Request) {
  const access = await authorizeAdminApi("reviews");
  if (!access.user) return NextResponse.json({ error: "Review moderation permission required." }, { status: access.status });
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid moderation action." }, { status: 400 });
  const ipAddress = requestIp(request);
  if (parsed.data.action === "bulk_publish") {
    const reviews = await prisma.review.findMany({ where: { id: { in: parsed.data.reviewIds }, status: "PENDING" }, select: { id: true, title: true, body: true } });
    const flagged = await Promise.all(reviews.map(async (review) => ({ review, flags: await reviewFlags(review) })));
    const cleanIds = flagged.filter((entry) => entry.flags.clean).map((entry) => entry.review.id);
    if (cleanIds.length) await prisma.review.updateMany({ where: { id: { in: cleanIds }, status: "PENDING" }, data: { status: "PUBLISHED" } });
    await writeAdminAudit({ actorId: access.user.id, action: "REVIEWS_BULK_PUBLISH", entity: "Review", after: { publishedIds: cleanIds, flaggedIds: flagged.filter((entry) => !entry.flags.clean).map((entry) => entry.review.id) }, ipAddress });
    return NextResponse.json({ published: cleanIds.length, skippedFlagged: flagged.length - cleanIds.length });
  }
  const review = await prisma.review.findUnique({ where: { id: parsed.data.reviewId } });
  if (!review) return NextResponse.json({ error: "Review not found." }, { status: 404 });
  const before = { status: review.status, body: review.body, reportedAt: review.reportedAt };
  if (parsed.data.action === "delete") {
    if (access.user.role !== "ADMIN") return NextResponse.json({ error: "Deleting reviews is ADMIN-only." }, { status: 403 });
    await writeAdminAudit({ actorId: access.user.id, action: "REVIEW_DELETE", entity: "Review", entityId: review.id, agencyId: review.agencyId, before, after: { deleted: true, reason: parsed.data.reason }, ipAddress });
    await prisma.review.delete({ where: { id: review.id } });
    return NextResponse.json({ deleted: true });
  }
  const data = parsed.data.action === "publish" ? { status: "PUBLISHED" as const, reportedAt: null, reportReason: null }
    : parsed.data.action === "reject" ? { status: "REJECTED" as const }
      : { body: parsed.data.body, status: review.status };
  const updated = await prisma.review.update({ where: { id: review.id }, data });
  await writeAdminAudit({ actorId: access.user.id, action: `REVIEW_${parsed.data.action.toUpperCase()}`, entity: "Review", entityId: review.id, agencyId: review.agencyId, before, after: { status: updated.status, body: updated.body, reason: parsed.data.action === "reject" ? parsed.data.reason : undefined }, ipAddress });
  return NextResponse.json({ review: updated });
}