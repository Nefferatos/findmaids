import { NextResponse } from "next/server";
import { ProspectStage } from "@prisma/client";
import { z } from "zod";
import { authorizeAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { requestIp, writeAdminAudit } from "@/lib/admin-audit";
import { escapeCsv, parseCsv } from "@/lib/csv";
import { validateProspectStage } from "@/lib/leads/prospect-policy";

const createSchema = z.object({
  agencyName: z.string().trim().min(2).max(180),
  contactName: z.string().trim().max(140).optional(),
  phone: z.string().trim().max(40).optional(),
  whatsapp: z.string().trim().max(40).optional(),
  email: z.string().trim().email().max(254).optional().or(z.literal("")),
  city: z.string().trim().min(2).max(120),
  licenseNumber: z.string().trim().max(160).optional(),
  licenseCheckedAt: z.iso.datetime().optional(),
  licenseSource: z.string().trim().max(500).optional(),
  contactDetailsSource: z.string().trim().min(3).max(1000),
  source: z.string().trim().min(2).max(160),
  notes: z.string().max(5000).optional(),
  lastContactedAt: z.iso.datetime().optional(),
  nextActionAt: z.iso.datetime().optional(),
  ownerUserId: z.string().optional(),
  stage: z.enum(ProspectStage).optional(),
});

const updateSchema = createSchema.partial().extend({
  id: z.string().min(1),
  lastContactedAt: z.iso.datetime().nullable().optional(),
  licenseCheckedAt: z.iso.datetime().nullable().optional(),
  agencyId: z.string().nullable().optional(),
});

export async function GET(request: Request) {
  const access = await authorizeAdminApi("prospects");
  if (!access.user || access.user.role !== "ADMIN")
    return NextResponse.json(
      { error: "ADMIN access required." },
      { status: access.status || 403 },
    );
  const url = new URL(request.url);
  const stage = url.searchParams.get("stage");
  const city = url.searchParams.get("city");
  const where = {
    ...(stage && validateProspectStage(stage) ? { stage } : {}),
    ...(city
      ? { city: { contains: city.slice(0, 120), mode: "insensitive" as const } }
      : {}),
  };
  const prospects = await prisma.prospect.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true, email: true } },
      agency: { select: { id: true, name: true, slug: true } },
    },
    orderBy: [{ nextActionAt: "asc" }, { updatedAt: "desc" }],
    take: 1000,
  });
  if (url.searchParams.get("format") === "csv") {
    const fields = [
      "agencyName",
      "contactName",
      "phone",
      "whatsapp",
      "email",
      "city",
      "licenseNumber",
      "licenseCheckedAt",
      "licenseSource",
      "contactDetailsSource",
      "stage",
      "source",
      "notes",
      "lastContactedAt",
      "nextActionAt",
      "ownerUserId",
      "agencyId",
    ] as const;
    const csv = [
      fields.join(","),
      ...prospects.map((prospect) =>
        fields.map((field) => escapeCsv(prospect[field])).join(","),
      ),
    ].join("\r\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=findmaids-prospects.csv",
        "Cache-Control": "private, no-store",
      },
    });
  }
  return NextResponse.json({
    prospects,
    overdueFollowUps: prospects.filter(
      (prospect) =>
        prospect.nextActionAt &&
        prospect.nextActionAt < new Date() &&
        prospect.stage !== "DO_NOT_CONTACT" &&
        prospect.stage !== "DECLINED",
    ),
  });
}

export async function POST(request: Request) {
  const access = await authorizeAdminApi("prospects");
  if (!access.user || access.user.role !== "ADMIN")
    return NextResponse.json(
      { error: "ADMIN access required." },
      { status: access.status || 403 },
    );
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("text/csv")) {
    const text = await request.text();
    if (text.length > 1_000_000)
      return NextResponse.json(
        { error: "CSV must be under 1 MB." },
        { status: 413 },
      );
    let rows: Record<string, string>[];
    try {
      rows = parseCsv(text);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid CSV." },
        { status: 400 },
      );
    }
    const validated: z.infer<typeof createSchema>[] = [];
    for (const row of rows) {
      const parsed = createSchema.safeParse({
        ...row,
        stage: row.stage || undefined,
      });
      if (!parsed.success)
        return NextResponse.json(
          {
            error: `Invalid CSV row ${validated.length + 2}: ${parsed.error.issues[0]?.message ?? "invalid data"}`,
          },
          { status: 400 },
        );
      validated.push(parsed.data);
    }
    const ids = await prisma.$transaction(async (tx) => {
      const created: string[] = [];
      for (const data of validated) {
        const prospect = await tx.prospect.create({
          data: { ...data, email: data.email || null },
        });
        created.push(prospect.id);
        await tx.auditLog.create({
          data: {
            userId: access.user!.id,
            action: "PROSPECT_IMPORTED",
            entity: "Prospect",
            entityId: prospect.id,
            metadata: {
              agencyName: prospect.agencyName,
              city: prospect.city,
              stage: prospect.stage,
              contactDetailsSource: prospect.contactDetailsSource,
            },
            ipAddress: requestIp(request) ?? undefined,
          },
        });
      }
      return created;
    });
    return NextResponse.json({ imported: ids.length }, { status: 201 });
  }
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid prospect data; contact source is required." },
      { status: 400 },
    );
  const prospect = await prisma.prospect.create({
    data: { ...parsed.data, email: parsed.data.email || null },
  });
  await writeAdminAudit({
    actorId: access.user.id,
    action: "PROSPECT_CREATED",
    entity: "Prospect",
    entityId: prospect.id,
    after: {
      agencyName: prospect.agencyName,
      city: prospect.city,
      stage: prospect.stage,
      contactDetailsSource: prospect.contactDetailsSource,
    },
    ipAddress: requestIp(request),
  });
  return NextResponse.json({ prospect }, { status: 201 });
}

export async function DELETE(request: Request) {
  const access = await authorizeAdminApi("prospects");
  if (!access.user || access.user.role !== "ADMIN")
    return NextResponse.json(
      { error: "ADMIN access required." },
      { status: access.status || 403 },
    );
  const parsed = z
    .object({
      id: z.string().min(1),
      verifiedRequestReference: z.string().trim().min(3).max(200),
      reason: z.string().trim().min(10).max(1000),
    })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Provide the verified request reference and deletion reason." },
      { status: 400 },
    );
  const prospect = await prisma.prospect.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, agencyId: true, stage: true },
  });
  if (!prospect)
    return NextResponse.json({ error: "Prospect not found." }, { status: 404 });
  await prisma.prospect.delete({ where: { id: prospect.id } });
  await writeAdminAudit({
    actorId: access.user.id,
    action: "PROSPECT_DELETED_ON_REQUEST",
    entity: "Prospect",
    entityId: prospect.id,
    agencyId: prospect.agencyId ?? undefined,
    after: {
      verifiedRequestReference: parsed.data.verifiedRequestReference,
      reason: parsed.data.reason,
      previousStage: prospect.stage,
    },
    ipAddress: requestIp(request),
  });
  return NextResponse.json({ deleted: true });
}

export async function PATCH(request: Request) {
  const access = await authorizeAdminApi("prospects");
  if (!access.user || access.user.role !== "ADMIN")
    return NextResponse.json(
      { error: "ADMIN access required." },
      { status: access.status || 403 },
    );
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid prospect update." },
      { status: 400 },
    );
  const { id, ...changes } = parsed.data;
  const before = await prisma.prospect.findUnique({ where: { id } });
  if (!before)
    return NextResponse.json({ error: "Prospect not found." }, { status: 404 });
  if (
    before.stage === "DO_NOT_CONTACT" &&
    changes.stage &&
    changes.stage !== "DO_NOT_CONTACT"
  )
    return NextResponse.json(
      {
        error:
          "DO_NOT_CONTACT is a permanent outreach suppression state. Create a new prospect record only after documented renewed consent.",
      },
      { status: 409 },
    );
  if (changes.stage === "CONTACTED" && !changes.lastContactedAt)
    changes.lastContactedAt = new Date().toISOString();
  const updated = await prisma.prospect.update({
    where: { id },
    data: { ...changes, email: changes.email === "" ? null : changes.email },
  });
  const changedFields = Object.keys(changes);
  await writeAdminAudit({
    actorId: access.user.id,
    action: "PROSPECT_UPDATED",
    entity: "Prospect",
    entityId: id,
    before: {
      stage: before.stage,
      nextActionAt: before.nextActionAt,
      agencyId: before.agencyId,
    },
    after: {
      stage: updated.stage,
      nextActionAt: updated.nextActionAt,
      agencyId: updated.agencyId,
      changedFields,
    },
    ipAddress: requestIp(request),
  });
  return NextResponse.json({ prospect: updated });
}
