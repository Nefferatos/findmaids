import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { maidColumns } from "@/lib/maid-write";
import { prisma } from "@/lib/prisma";
import { maidUpdateSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Context = { params: Promise<{ maidId: string }> };

async function ownedMaid(userId: string, maidId: string) {
  const agency = await prisma.agency.findUnique({
    where: { ownerId: userId },
    select: { id: true },
  });
  if (!agency) return null;
  const maid = await prisma.maid.findFirst({
    where: { id: maidId, agencyId: agency.id },
  });
  return maid ? { agency, maid } : null;
}

export async function PATCH(request: Request, { params }: Context) {
  const session = await auth();
  if (!session?.user || session.user.role !== "AGENCY")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = maidUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Review the maid details and retry." },
      { status: 400 },
    );
  const { maidId } = await params;
  const owned = await ownedMaid(session.user.id, maidId);
  if (!owned)
    return NextResponse.json(
      { error: "Maid profile not found." },
      { status: 404 },
    );
  const { agency, maid } = owned;
  const data = parsed.data;
  if (data.reference && data.reference !== maid.reference) {
    const clash = await prisma.maid.findFirst({
      where: { agencyId: agency.id, reference: data.reference },
      select: { id: true },
    });
    if (clash && clash.id !== maid.id)
      return NextResponse.json(
        { error: "That reference is already used by another maid profile." },
        { status: 409 },
      );
  }
  const update = maidColumns(data);

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.maid.update({
      where: { id: maid.id },
      data: update,
    });
    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        agencyId: agency.id,
        action: "MAID_UPDATED",
        entity: "Maid",
        entityId: saved.id,
        before: {
          reference: maid.reference,
          status: maid.status,
          published: maid.published,
        },
        after: {
          reference: saved.reference,
          status: saved.status,
          published: saved.published,
        },
      },
    });
    return saved;
  });
  return NextResponse.json({ maid: updated });
}

export async function DELETE(_request: Request, { params }: Context) {
  const session = await auth();
  if (!session?.user || session.user.role !== "AGENCY")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { maidId } = await params;
  const owned = await ownedMaid(session.user.id, maidId);
  if (!owned)
    return NextResponse.json(
      { error: "Maid profile not found." },
      { status: 404 },
    );
  const { agency, maid } = owned;
  await prisma.$transaction(async (tx) => {
    await tx.maid.delete({ where: { id: maid.id } });
    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        agencyId: agency.id,
        action: "MAID_DELETED",
        entity: "Maid",
        entityId: maid.id,
        before: {
          reference: maid.reference,
          status: maid.status,
          published: maid.published,
        },
      },
    });
  });
  return NextResponse.json({ ok: true });
}
