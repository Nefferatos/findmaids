import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { agencyScopedWhere } from "@/lib/tenant";

export async function PATCH() {
  const session = await auth();
  if (!session?.user || session.user.role !== "AGENCY")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const agency = await prisma.agency.findUnique({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!agency)
    return NextResponse.json({ error: "Agency not found." }, { status: 404 });
  const subscription = await prisma.subscription.findFirst({
    where: agencyScopedWhere(agency.id, { status: "ACTIVE" }),
    orderBy: { createdAt: "desc" },
  });
  if (!subscription)
    return NextResponse.json(
      { error: "No active subscription found." },
      { status: 404 },
    );
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { autoRenew: false, cancelAtPeriodEnd: true },
  });
  return NextResponse.json({
    cancelledAtPeriodEnd: true,
    endDate: subscription.endDate,
  });
}
