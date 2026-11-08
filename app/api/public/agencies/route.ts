import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sampleAgencyVisibilityWhere } from "@/lib/sample-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const sampleVisibility = sampleAgencyVisibilityWhere();
  const agencies = await prisma.agency.findMany({
    where: {
      status: "APPROVED",
      ...(sampleVisibility ? { AND: [sampleVisibility] } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return NextResponse.json({ agencies });
}
