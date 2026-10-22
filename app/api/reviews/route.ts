import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { reviewSubmissionSchema } from "@/lib/validation";

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
  const agency = await prisma.agency.findFirst({
    where: { id: parsed.data.agencyId, status: "APPROVED" },
    select: { id: true },
  });
  if (!agency)
    return NextResponse.json({ error: "Agency not found." }, { status: 404 });
  await prisma.review.create({ data: { ...parsed.data, status: "PENDING" } });
  return NextResponse.json(
    { message: "Thank you. Your review will appear after moderation." },
    { status: 201 },
  );
}
