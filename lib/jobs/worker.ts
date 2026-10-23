import { Worker } from "bullmq";
import { prisma } from "@/lib/prisma";
import { createJobConnection, type FindMaidsJob } from "@/lib/jobs/queue";
import { maskPii } from "@/lib/ai/guardrails";
import { embedLoggedText, generateLoggedText } from "@/lib/ai/call";
import { checkAiBudget } from "@/lib/ai/budget";
import { isFeatureEnabled } from "@/lib/ai/flags";
import { classifyLeadText } from "@/lib/ai/budget-policy";
import { summarizeLead } from "@/lib/jobs/lead-summary";
import { logger } from "@/lib/logger";

async function draftLeadReply(enquiryId: string) {
  const enquiry = await prisma.enquiry.findUnique({
    where: { id: enquiryId },
    include: { agency: { include: { aiSettings: true } } },
  });
  const settings = enquiry?.agency.aiSettings;
  if (!enquiry || !settings?.autoReplyEnabled || settings.replyMode !== "DRAFT")
    return;
  if (!(await isFeatureEnabled("agency_auto_reply", enquiry.agencyId))) return;
  if (!(await checkAiBudget(enquiry.agencyId)).allowed) return;

  const leadSignals = classifyLeadText(enquiry.message);
  if (leadSignals.urgency || leadSignals.spam || leadSignals.complaint) {
    if (settings.escalationEmail) {
      const { sendEmail } = await import("@/lib/email");
      await sendEmail(
        settings.escalationEmail,
        "Urgent FindMaids enquiry needs review",
        `Please review enquiry ${enquiry.id} in your agency dashboard.`,
      );
    }
    return;
  }

  const facts =
    settings.knowledgeBase?.trim() ??
    "No agency-specific knowledge base has been provided. Do not state prices, availability, or visa outcomes; say the agency will confirm.";
  try {
    const response = await generateLoggedText({
      feature: "agency_auto_reply",
      promptVersion: "agency-auto-reply.v1",
      agencyId: enquiry.agencyId,
      maxTokens: 300,
      messages: [
        {
          role: "system",
          content: `Draft a concise reply in ${settings.languages.join(" or ") || "English"}, tone ${settings.replyTone}. This is a draft for human approval. Do not promise price, availability, visa, placement, or outcomes unless directly supported by this agency knowledge base. If absent, say the agency will confirm.\nKnowledge base:\n${maskPii(facts).slice(0, 3000)}`,
        },
        { role: "user", content: maskPii(enquiry.message).slice(0, 2000) },
      ],
    });
    await prisma.enquiry.update({
      where: { id: enquiry.id },
      data: { aiReplyDraft: response.text },
    });
  } catch {
    await prisma.enquiry.update({
      where: { id: enquiry.id },
      data: {
        aiReplyDraft: `Thanks for contacting ${enquiry.agency.name}. Our team will review your enquiry and confirm details with you shortly.`,
      },
    });
  }
}

async function saveEmbedding(
  documentId: string,
  title: string,
  content: string,
  agencyId?: string | null,
) {
  const result = await embedLoggedText(
    `${title}\n${content}`,
    "knowledge_embedding",
    agencyId ?? undefined,
  );
  const vectorLiteral = `[${result.embedding.join(",")}]`;
  await prisma.$executeRaw`
    UPDATE "KnowledgeDocument"
    SET "embedding" = ${vectorLiteral}::vector, "updatedAt" = NOW()
    WHERE "id" = ${documentId}
  `;
}

async function embedAgency(agencyId: string) {
  if (!(await isFeatureEnabled("agency_knowledge_base", agencyId))) return;
  if (!(await checkAiBudget(agencyId)).allowed) return;
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: {
      name: true,
      description: true,
      city: true,
      province: true,
      services: true,
      languages: true,
      aiSettings: { select: { knowledgeBase: true } },
    },
  });
  if (!agency) return;
  const title = `${agency.name} profile`;
  const content = [
    agency.description,
    `Location: ${agency.city}, ${agency.province}`,
    `Services: ${agency.services.join(", ")}`,
    `Languages: ${agency.languages.join(", ")}`,
    agency.aiSettings?.knowledgeBase,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 12000);
  const existing = await prisma.knowledgeDocument.findFirst({
    where: { agencyId, title },
    select: { id: true },
  });
  const document = existing
    ? await prisma.knowledgeDocument.update({
        where: { id: existing.id },
        data: { content },
        select: { id: true },
      })
    : await prisma.knowledgeDocument.create({
        data: { agencyId, title, content },
        select: { id: true },
      });
  await saveEmbedding(document.id, title, content, agencyId);
}

async function embedKnowledgeDocument(documentId: string) {
  const document = await prisma.knowledgeDocument.findUnique({
    where: { id: documentId },
    select: { id: true, title: true, content: true, agencyId: true },
  });
  if (!document) return;
  if (document.agencyId) {
    if (!(await isFeatureEnabled("agency_knowledge_base", document.agencyId)))
      return;
    if (!(await checkAiBudget(document.agencyId)).allowed) return;
  } else if (!(await isFeatureEnabled("platform_knowledge_base"))) {
    return;
  }
  await saveEmbedding(
    document.id,
    document.title,
    document.content,
    document.agencyId,
  );
}

const worker = new Worker<FindMaidsJob>(
  "findmaids-ai",
  async (job) => {
    switch (job.data.type) {
      case "lead.summary":
        await summarizeLead(job.data.enquiryId);
        break;
      case "lead.reply-draft":
        await draftLeadReply(job.data.enquiryId);
        break;
      case "agency.embed":
        await embedAgency(job.data.agencyId);
        break;
      case "knowledge.embed":
        await embedKnowledgeDocument(job.data.documentId);
        break;
    }
  },
  { connection: createJobConnection() },
);

worker.on("completed", (job) =>
  logger.info({ jobId: job.id, jobType: job.name }, "AI job completed"),
);
worker.on("failed", (job, error) =>
  logger.error(
    { jobId: job?.id, jobType: job?.name ?? "unknown", errorType: error.name },
    "AI job failed",
  ),
);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void worker.close().finally(() => process.exit(0));
  });
}
