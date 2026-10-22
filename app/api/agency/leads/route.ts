import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { agencyScopedWhere } from "@/lib/tenant";

const updateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["NEW", "CONTACTED", "CLOSED"]).optional(),
  privateNotes: z.string().max(5000).optional(),
});

async function ownedAgency() {
  const session = await auth();
  if (!session?.user || session.user.role !== "AGENCY") return null;
  return prisma.agency.findUnique({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
}

export async function GET(request: Request) {
  const agency = await ownedAgency();
  if (!agency)
    return NextResponse.json(
      { error: "Agency access required." },
      { status: 403 },
    );
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const start = url.searchParams.get("from");
  const end = url.searchParams.get("to");
  const dateSchema = z.iso.date();
  if (
    (start && !dateSchema.safeParse(start).success) ||
    (end && !dateSchema.safeParse(end).success)
  )
    return NextResponse.json(
      { error: "Use valid YYYY-MM-DD dates." },
      { status: 400 },
    );
  const leads = await prisma.enquiry.findMany({
    where: agencyScopedWhere(agency.id, {
      ...(status && ["NEW", "CONTACTED", "CLOSED"].includes(status)
        ? { status: status as "NEW" | "CONTACTED" | "CLOSED" }
        : {}),
      ...(start || end
        ? {
            createdAt: {
              ...(start ? { gte: new Date(start) } : {}),
              ...(end ? { lte: new Date(`${end}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    }),
    orderBy: { createdAt: "desc" },
    take: 250,
  });
  if (url.searchParams.get("format") === "csv") {
    const escape = (value: string | null) =>
      `"${(value ?? "").replaceAll('"', '""')}"`;
    const csv = [
      "id,name,email,phone,status,createdAt,message,privateNotes",
      ...leads.map((lead) =>
        [
          lead.id,
          lead.name,
          lead.email,
          lead.phone,
          lead.status,
          lead.createdAt.toISOString(),
          lead.message,
          lead.privateNotes,
        ]
          .map(escape)
          .join(","),
      ),
    ].join("\r\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=findmaids-leads.csv",
        "Cache-Control": "no-store",
      },
    });
  }
  return NextResponse.json({ leads });
}

export async function PATCH(request: Request) {
  const agency = await ownedAgency();
  if (!agency)
    return NextResponse.json(
      { error: "Agency access required." },
      { status: 403 },
    );
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid lead update." },
      { status: 400 },
    );
  const updated = await prisma.enquiry.updateMany({
    where: agencyScopedWhere(agency.id, { id: parsed.data.id }),
    data: {
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.privateNotes !== undefined
        ? { privateNotes: parsed.data.privateNotes }
        : {}),
    },
  });
  return updated.count
    ? NextResponse.json({ updated: true })
    : NextResponse.json({ error: "Lead not found." }, { status: 404 });
}
