import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { isFeatureEnabled } from "@/lib/ai/flags";
import { enqueueJob } from "@/lib/jobs/queue";

const settingsSchema = z.object({
  autoReplyEnabled: z.boolean(),
  replyMode: z.literal("DRAFT"),
  replyTone: z.enum(["professional", "warm", "concise"]),
  businessHours: z
    .record(
      z.string(),
      z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.array(z.unknown()),
      ]),
    )
    .nullable(),
  languages: z.array(z.enum(["English", "Filipino", "Taglish"])).max(3),
  escalationEmail: z.email().nullable(),
  knowledgeBase: z.string().max(10000),
});

async function agencyContext() {
  const session = await auth();
  if (!session?.user || session.user.role !== "AGENCY") return null;
  const agency = await prisma.agency.findUnique({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  return agency ? { userId: session.user.id, agencyId: agency.id } : null;
}

export async function GET() {
  const context = await agencyContext();
  if (!context)
    return NextResponse.json(
      { error: "Agency access required." },
      { status: 401 },
    );
  const [settings, callCount, spend, conversations, feedback] =
    await Promise.all([
      prisma.agencyAiSettings.findUnique({
        where: { agencyId: context.agencyId },
      }),
      prisma.aiCallLog.count({
        where: { agencyId: context.agencyId, createdAt: { gte: monthStart() } },
      }),
      prisma.aiCallLog.aggregate({
        where: {
          agencyId: context.agencyId,
          createdAt: { gte: monthStart() },
          status: "success",
        },
        _sum: { costEstimate: true },
      }),
      prisma.conversation.findMany({
        where: { agencyId: context.agencyId },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            take: 30,
            select: {
              id: true,
              role: true,
              content: true,
              createdAt: true,
              feedback: { select: { rating: true } },
            },
          },
          handoffs: {
            where: { status: "OPEN" },
            select: { id: true, reason: true, createdAt: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
      }),
      prisma.aiFeedback.aggregate({
        where: { message: { conversation: { agencyId: context.agencyId } } },
        _avg: { rating: true },
        _count: { id: true },
      }),
    ]);
  const plan = await prisma.subscription.findFirst({
    where: { agencyId: context.agencyId, status: "ACTIVE" },
    include: { plan: { select: { aiMonthlyBudgetPhp: true } } },
    orderBy: { createdAt: "desc" },
  });
  const monthlyCap = Number(
    plan?.plan.aiMonthlyBudgetPhp ??
      process.env.AI_DEFAULT_AGENCY_BUDGET_PHP ??
      50,
  );
  const spendPhp = Number(spend._sum.costEstimate ?? 0);
  return NextResponse.json({
    settings: settings ?? {
      autoReplyEnabled: false,
      replyMode: "DRAFT",
      replyTone: "professional",
      businessHours: null,
      languages: ["English"],
      escalationEmail: null,
      knowledgeBase: "",
    },
    usage: {
      calls: callCount,
      spendPhp,
      monthlyCapPhp: monthlyCap,
      remainingPhp: Math.max(0, monthlyCap - spendPhp),
    },
    conversations,
    feedbackStats: {
      averageRating: feedback._avg.rating,
      count: feedback._count.id,
    },
  });
}

export async function PUT(request: Request) {
  const context = await agencyContext();
  if (!context)
    return NextResponse.json(
      { error: "Agency access required." },
      { status: 401 },
    );
  if (
    !(await checkRateLimit(`agency-ai-settings:${context.userId}`, 20, 3600))
      .allowed
  )
    return NextResponse.json(
      { error: "Settings update limit reached." },
      { status: 429 },
    );
  const parsed = settingsSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      {
        error:
          "Invalid AI settings. Auto-send is not available; use DRAFT mode.",
      },
      { status: 400 },
    );
  if (
    parsed.data.autoReplyEnabled &&
    !(await isFeatureEnabled("agency_auto_reply", context.agencyId))
  )
    return NextResponse.json(
      { error: "Ask an administrator to enable reply drafts first." },
      { status: 403 },
    );
  const data: Prisma.AgencyAiSettingsUncheckedCreateInput = {
    agencyId: context.agencyId,
    ...parsed.data,
    businessHours: parsed.data.businessHours as
      Prisma.InputJsonValue | typeof Prisma.JsonNull,
  };
  const settings = await prisma.agencyAiSettings.upsert({
    where: { agencyId: context.agencyId },
    create: data,
    update: data,
  });
  if (await isFeatureEnabled("agency_knowledge_base", context.agencyId)) {
    await prisma.knowledgeDocument.deleteMany({
      where: {
        agencyId: context.agencyId,
        title: { startsWith: "Agency KB:" },
      },
    });
    const chunks = parsed.data.knowledgeBase.match(/[\s\S]{1,1200}/g) ?? [];
    for (const [index, content] of chunks.entries()) {
      const document = await prisma.knowledgeDocument.create({
        data: {
          agencyId: context.agencyId,
          title: `Agency KB: ${index + 1}`,
          content,
        },
        select: { id: true },
      });
      await enqueueJob({
        type: "knowledge.embed",
        documentId: document.id,
      }).catch(() => false);
    }
  }
  return NextResponse.json({ settings });
}

function monthStart() {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}
