import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdminApi } from "@/lib/admin-auth";
import { requestIp, writeAdminAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";
import { maskPii } from "@/lib/ai/guardrails";

export async function GET() {
  const access = await authorizeAdminApi("settings");
  if (!access.user || access.user.role !== "ADMIN")
    return NextResponse.json(
      { error: "ADMIN AI control required." },
      { status: access.status || 403 },
    );
  const [control, flags, logs, agencyFlags] = await Promise.all([
    prisma.adminSetting.findUnique({ where: { key: "aiControl" } }),
    prisma.adminSetting.findUnique({ where: { key: "featureFlags" } }),
    prisma.aiCallLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        feature: true,
        model: true,
        promptVersion: true,
        inputTokens: true,
        outputTokens: true,
        latencyMs: true,
        costEstimate: true,
        status: true,
        errorMessage: true,
        agencyId: true,
        createdAt: true,
      },
    }),
    prisma.featureFlag.findMany({
      where: { scope: "AGENCY" },
      include: { agency: { select: { id: true, name: true } } },
      orderBy: [{ key: "asc" }, { agencyId: "asc" }],
      take: 500,
    }),
  ]);
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const costByFeature = await prisma.aiCallLog.groupBy({
    by: ["feature"],
    where: { createdAt: { gte: monthStart }, status: "success" },
    _sum: { costEstimate: true },
    _count: { id: true },
  });
  return NextResponse.json({
    killSwitch: Boolean(
      control?.value &&
      typeof control.value === "object" &&
      (control.value as Record<string, unknown>).killSwitch === true,
    ),
    featureFlags: flags?.value ?? {},
    costByFeature,
    agencyFlags,
    logs: logs.map((log) => ({
      ...log,
      errorMessage: log.errorMessage ? maskPii(log.errorMessage) : null,
      createdAt: log.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const access = await authorizeAdminApi("reports");
  if (!access.user || access.user.role !== "ADMIN")
    return NextResponse.json(
      { error: "ADMIN insights access required." },
      { status: access.status || 403 },
    );
  const parsed = z
    .object({
      question: z.string().trim().min(3).max(300),
      from: z.iso.date().optional(),
      to: z.iso.date().optional(),
    })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid read-only report request." },
      { status: 400 },
    );
  const question = parsed.data.question.toLowerCase();
  const tool = /renew|expir|churn/.test(question)
    ? "queryRenewals"
    : /lead|enquir/.test(question)
      ? "queryLeads"
      : /agenc|approval|listing/.test(question)
        ? "queryAgencies"
        : /revenue|payment|income|sales/.test(question)
          ? "queryRevenue"
          : null;
  if (!tool)
    return NextResponse.json(
      { error: "Ask about revenue, leads, agencies, or renewals." },
      { status: 400 },
    );
  let result: unknown;
  if (tool === "queryRevenue") {
    const from = parsed.data.from
      ? new Date(`${parsed.data.from}T00:00:00.000Z`)
      : new Date(Date.now() - 30 * 86_400_000);
    const to = parsed.data.to
      ? new Date(`${parsed.data.to}T23:59:59.999Z`)
      : new Date();
    result = await prisma.payment.aggregate({
      where: { status: "PAID", paidAt: { gte: from, lte: to } },
      _sum: { amount: true },
      _count: { id: true },
    });
  } else if (tool === "queryLeads") {
    const from = parsed.data.from
      ? new Date(`${parsed.data.from}T00:00:00.000Z`)
      : new Date(Date.now() - 30 * 86_400_000);
    const to = parsed.data.to
      ? new Date(`${parsed.data.to}T23:59:59.999Z`)
      : new Date();
    result = await prisma.enquiry.groupBy({
      by: ["source", "status"],
      where: { createdAt: { gte: from, lte: to } },
      _count: { id: true },
    });
  } else if (tool === "queryAgencies")
    result = await prisma.agency.groupBy({
      by: ["status"],
      _count: { id: true },
    });
  else
    result = await prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        endDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 30 * 86_400_000),
        },
      },
      select: {
        id: true,
        endDate: true,
        agency: { select: { name: true } },
        plan: { select: { name: true } },
      },
      take: 500,
    });
  await writeAdminAudit({
    actorId: access.user.id,
    action: "AI_ASK_DATA_QUERY",
    entity: "AdminInsight",
    after: {
      tool,
      question: parsed.data.question,
      filters: { from: parsed.data.from, to: parsed.data.to },
    },
    ipAddress: requestIp(request),
  });
  return NextResponse.json({ tool, result });
}

export async function PUT(request: Request) {
  const access = await authorizeAdminApi("settings");
  if (!access.user || access.user.role !== "ADMIN")
    return NextResponse.json(
      { error: "ADMIN AI control required." },
      { status: access.status || 403 },
    );
  const parsed = z
    .discriminatedUnion("action", [
      z.object({ action: z.literal("killSwitch"), enabled: z.boolean() }),
      z.object({
        action: z.literal("featureFlags"),
        flags: z.record(z.string(), z.boolean()),
      }),
      z.object({
        action: z.literal("agencyFlag"),
        agencyId: z.string().min(1),
        key: z.enum([
          "employer_assistant",
          "agency_auto_reply",
          "agency_profile_helper",
          "agency_knowledge_base",
          "review_moderation_assist",
        ]),
        enabled: z.boolean(),
      }),
    ])
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid AI control update." },
      { status: 400 },
    );
  if (parsed.data.action === "agencyFlag") {
    const agency = await prisma.agency.findUnique({
      where: { id: parsed.data.agencyId },
      select: { id: true },
    });
    if (!agency)
      return NextResponse.json({ error: "Agency not found." }, { status: 404 });
    const before = await prisma.featureFlag.findFirst({
      where: { key: parsed.data.key, scope: "AGENCY", agencyId: agency.id },
    });
    const flag = before
      ? await prisma.featureFlag.update({
          where: { id: before.id },
          data: { enabled: parsed.data.enabled },
        })
      : await prisma.featureFlag.create({
          data: {
            key: parsed.data.key,
            scope: "AGENCY",
            agencyId: agency.id,
            enabled: parsed.data.enabled,
          },
        });
    await writeAdminAudit({
      actorId: access.user.id,
      action: "AI_AGENCY_FLAG_UPDATE",
      entity: "FeatureFlag",
      entityId: flag.id,
      before,
      after: flag,
      ipAddress: requestIp(request),
    });
    return NextResponse.json({ flag });
  }
  const key =
    parsed.data.action === "killSwitch" ? "aiControl" : "featureFlags";
  const value =
    parsed.data.action === "killSwitch"
      ? { killSwitch: parsed.data.enabled }
      : parsed.data.flags;
  const before = await prisma.adminSetting.findUnique({ where: { key } });
  const setting = await prisma.adminSetting.upsert({
    where: { key },
    create: { key, value, updatedById: access.user.id },
    update: { value, updatedById: access.user.id },
  });
  await writeAdminAudit({
    actorId: access.user.id,
    action:
      parsed.data.action === "killSwitch"
        ? "AI_KILL_SWITCH_UPDATE"
        : "AI_FEATURE_FLAGS_UPDATE",
    entity: "AdminSetting",
    entityId: key,
    before: before?.value,
    after: value,
    ipAddress: requestIp(request),
  });
  return NextResponse.json({ setting });
}
