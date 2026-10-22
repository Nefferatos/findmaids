import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { reviewSubmissionSchema } from "@/lib/validation";
import { hasBlockedPattern, moderateText, hashBlockValue } from "@/lib/moderation";

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await checkRateLimit(`review:${ip}`, 3, 3600)).allowed)
    return NextResponse.json(
      { error: "Review limit reached. Try again later." },
      { status: 429 },
    );
  const parsed = reviewSubmissionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Please check the review fields." },
      { status: 400 },
    );
  const clientIp = request.headers.get("cf-connecting-ip") ?? ip;
  if (await hasBlockedPattern({ ip: clientIp }))
    return NextResponse.json({ error: "Review submission unavailable." }, { status: 403 });
  const agency = await prisma.agency.findFirst({
    where: { id: parsed.data.agencyId, status: "APPROVED" },
    select: { id: true },
  });
  if (!agency)
    return NextResponse.json({ error: "Agency not found." }, { status: 404 });
  const flags = moderateText(parsed.data);
  await prisma.review.create({
    data: {
      ...parsed.data,
      reviewerEmail: parsed.data.reviewerEmail || null,
      status: "PENDING",
      authorIpHash: hashBlockValue(clientIp),
    },
  });
  return NextResponse.json(
    { message: "Thank you. Your review will appear after moderation.", moderationFlags: flags.flags },
    { status: 201 },
  );
}
