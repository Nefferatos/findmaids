import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma/client";
import { auth } from "@/auth";
import { AGENCY_MAID_LIMIT } from "@/lib/maids";
import { maidColumns } from "@/lib/maid-write";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { maidCreateSchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * An agency's own maid roster, including unpublished profiles. The public
 * directory only ever sees `published: true` rows (see lib/maids.ts).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "AGENCY")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const agency = await prisma.agency.findUnique({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!agency)
    return NextResponse.json({ error: "Agency not found." }, { status: 404 });
  const maids = await prisma.maid.findMany({
    where: { agencyId: agency.id },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(
    { maids, limit: AGENCY_MAID_LIMIT },
    // Private roster: never cache it at a proxy or in the browser.
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "AGENCY")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (
    !(await checkRateLimit(`maid-write:${session.user.id}`, 40, 3600)).allowed
  )
    return NextResponse.json(
      { error: "Too many changes. Try again later." },
      { status: 429 },
    );
  const parsed = maidCreateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Review the maid details and retry." },
      { status: 400 },
    );
  const data = parsed.data;
  const agency = await prisma.agency.findUnique({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!agency)
    return NextResponse.json({ error: "Agency not found." }, { status: 404 });
  const count = await prisma.maid.count({ where: { agencyId: agency.id } });
  if (count >= AGENCY_MAID_LIMIT)
    return NextResponse.json(
      {
        error: `You can keep up to ${AGENCY_MAID_LIMIT} maid profiles. Remove one to add another.`,
      },
      { status: 409 },
    );
  const duplicate = await prisma.maid.findFirst({
    where: { agencyId: agency.id, reference: data.reference },
    select: { id: true },
  });
  if (duplicate)
    return NextResponse.json(
      { error: "That reference is already used by another maid profile." },
      { status: 409 },
    );
  try {
    const maid = await prisma.$transaction(async (tx) => {
      const created = await tx.maid.create({
        data: {
          ...maidColumns(data),
          agencyId: agency.id,
          reference: data.reference,
          nationality: data.nationality,
          placementType: data.placementType,
          languages: data.languages ?? [],
          duties: data.duties ?? [],
          status: data.status ?? "AVAILABLE",
          published: data.published ?? true,
          // Sample rows are seed-only; an agency can never create one.
          isSample: false,
        } as Prisma.MaidUncheckedCreateInput,
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          agencyId: agency.id,
          action: "MAID_CREATED",
          entity: "Maid",
          entityId: created.id,
          after: {
            reference: created.reference,
            status: created.status,
            published: created.published,
          },
        },
      });
      return created;
    });
    return NextResponse.json({ maid }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002")
      return NextResponse.json(
        { error: "That reference is already used by another maid profile." },
        { status: 409 },
      );
    throw error;
  }
}
