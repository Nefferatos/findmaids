import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkAiBudget } from "@/lib/ai/budget";
import { streamLoggedText } from "@/lib/ai/call";
import { isFeatureEnabled } from "@/lib/ai/flags";
import {
  checkInputLength,
  classifySafetyIntent,
  maskPii,
} from "@/lib/ai/guardrails";
import {
  employerAssistantPromptVersion,
  employerAssistantSystemPrompt,
} from "@/lib/ai/prompts/employer-assistant.v1";
import { getAgencyDetails, getFaqAnswer, searchAgencies } from "@/lib/ai/tools";
import { acquisitionSourceSchema } from "@/lib/attribution";
import {
  chatCookieName,
  createVisitorToken,
  hashVisitorToken,
  signVisitorToken,
  verifyVisitorCookie,
} from "@/lib/ai/chat-session";

const cookieName = chatCookieName;
const schema = z.object({
  message: z.string().trim().min(1).max(3000),
  conversationId: z.string().optional(),
  language: z.enum(["en", "fil", "tl"]).default("en"),
  consent: z.boolean().optional(),
  enquiry: z
    .object({
      agencyId: z.string().min(1),
      name: z.string().trim().min(1).max(120),
      email: z.string().email(),
      phone: z.string().trim().max(40).optional(),
      message: z.string().trim().min(5).max(4000),
      acquisitionSource: acquisitionSourceSchema.optional(),
    })
    .optional(),
  agencySlug: z.string().max(120).optional(),
});

function localized(language: "en" | "fil" | "tl", text: string) {
  if (language === "fil") return `AI assistant ito ng FindMaids. ${text}`;
  if (language === "tl") return `AI assistant ito ng FindMaids. ${text}`;
  return `You're chatting with a FindMaids AI assistant. ${text}`;
}

function streamResponse(
  answer: string,
  data: Record<string, unknown>,
  token: string,
) {
  const encoder = new TextEncoder();
  const chunks = answer.match(/.{1,28}(?:\s|$)/g) ?? [answer];
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(`event: meta\ndata: ${JSON.stringify(data)}\n\n`),
      );
      for (const chunk of chunks)
        controller.enqueue(
          encoder.encode(
            `event: token\ndata: ${JSON.stringify({ text: chunk })}\n\n`,
          ),
        );
      controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
      controller.close();
    },
  });
  const response = new Response(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
  response.headers.append(
    "Set-Cookie",
    `${cookieName}=${encodeURIComponent(signVisitorToken(token))}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
  return response;
}

function streamProviderResponse(input: {
  chunks: AsyncIterable<string>;
  fallback: string;
  initial: string;
  metadata: Record<string, unknown>;
  token: string;
  save: (answer: string) => Promise<string>;
}) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      void (async () => {
        controller.enqueue(
          encoder.encode(
            `event: meta\ndata: ${JSON.stringify(input.metadata)}\n\n`,
          ),
        );
        let answer = input.initial;
        if (input.initial)
          controller.enqueue(
            encoder.encode(
              `event: token\ndata: ${JSON.stringify({ text: input.initial })}\n\n`,
            ),
          );
        try {
          for await (const chunk of input.chunks) {
            answer += chunk;
            controller.enqueue(
              encoder.encode(
                `event: token\ndata: ${JSON.stringify({ text: chunk })}\n\n`,
              ),
            );
          }
        } catch {
          answer += input.fallback;
          controller.enqueue(
            encoder.encode(
              `event: token\ndata: ${JSON.stringify({ text: input.fallback })}\n\n`,
            ),
          );
        }
        const messageId = await input.save(answer);
        controller.enqueue(
          encoder.encode(
            `event: done\ndata: ${JSON.stringify({ messageId })}\n\n`,
          ),
        );
        controller.close();
      })().catch((error) => controller.error(error));
    },
  });
  const response = new Response(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
  response.headers.append(
    "Set-Cookie",
    `${cookieName}=${encodeURIComponent(signVisitorToken(input.token))}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
  return response;
}

function extractCity(message: string) {
  return message
    .match(/\b(?:in|around|near)\s+([A-Z][\p{L} -]{1,40})/u)?.[1]
    ?.trim();
}
function extractServices(message: string) {
  return [
    "nanny",
    "caregiver",
    "household helper",
    "kasambahay",
    "yaya",
  ].filter((service) => message.toLowerCase().includes(service));
}

export async function GET() {
  const cookieJar = await cookies();
  const token = verifyVisitorCookie(cookieJar.get(cookieName)?.value);
  const tokenHash = token ? hashVisitorToken(token) : null;
  const conversation = tokenHash
    ? await prisma.conversation.findFirst({
        where: {
          visitorTokenHash: tokenHash,
          status: { not: "CLOSED" },
          retentionExpiresAt: { gt: new Date() },
        },
        select: {
          id: true,
          language: true,
          messages: {
            orderBy: { createdAt: "asc" },
            take: 50,
            select: { id: true, role: true, content: true },
          },
        },
      })
    : null;
  return NextResponse.json({
    enabled: await isFeatureEnabled("employer_assistant"),
    conversationId: conversation?.id ?? null,
    language: conversation?.language ?? "en",
    messages:
      conversation?.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
      })) ?? [],
    hasVisitorCookie: Boolean(token),
  });
}

export async function POST(request: Request) {
  if (!(await isFeatureEnabled("employer_assistant")))
    return NextResponse.json(
      { error: "Chat is not enabled." },
      { status: 404 },
    );
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  if (!(await checkRateLimit(`chat-ip:${ip}`, 30, 3600)).allowed)
    return NextResponse.json(
      { error: "Message limit reached." },
      { status: 429 },
    );
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !checkInputLength(parsed.data?.message ?? "", 3000))
    return NextResponse.json({ error: "Invalid message." }, { status: 400 });
  const input = parsed.data;
  const cookieJar = await cookies();
  let token =
    verifyVisitorCookie(cookieJar.get(cookieName)?.value) ??
    createVisitorToken();
  let tokenHash = hashVisitorToken(token);
  let conversation = input.conversationId
    ? await prisma.conversation.findFirst({
        where: {
          id: input.conversationId,
          visitorTokenHash: tokenHash,
          status: { not: "CLOSED" },
          retentionExpiresAt: { gt: new Date() },
        },
      })
    : await prisma.conversation.findFirst({
        where: {
          visitorTokenHash: tokenHash,
          status: { not: "CLOSED" },
          retentionExpiresAt: { gt: new Date() },
        },
      });
  if (!conversation) {
    const previousConversation = await prisma.conversation.findUnique({
      where: { visitorTokenHash: tokenHash },
      select: { id: true },
    });
    if (previousConversation) {
      token = createVisitorToken();
      tokenHash = hashVisitorToken(token);
    }
    conversation = await prisma.conversation.create({
      data: {
        channel: "WEB",
        visitorTokenHash: tokenHash,
        language: input.language,
        sourceIpHash: createHash("sha256").update(ip).digest("hex"),
        retentionExpiresAt: new Date(Date.now() + 365 * 86_400_000),
        ...(input.agencySlug
          ? { agency: { connect: { slug: input.agencySlug } } }
          : {}),
      },
    });
  }
  const [count, userLimit] = await Promise.all([
    prisma.message.count({
      where: { conversationId: conversation.id, role: "USER" },
    }),
    checkRateLimit(`chat-conversation:${conversation.id}`, 30, 3600),
  ]);
  if (count >= 50)
    return NextResponse.json(
      {
        error:
          "This conversation reached its message limit. Please request a human handoff.",
      },
      { status: 429 },
    );
  if (!userLimit.allowed)
    return NextResponse.json(
      { error: "Conversation message limit reached." },
      { status: 429 },
    );
  if (input.enquiry) {
    if (!input.consent)
      return NextResponse.json(
        { error: "Consent is required before sharing contact details." },
        { status: 400 },
      );
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { consentAt: conversation.consentAt ?? new Date() },
    });
    const created = await import("@/lib/ai/tools/create-enquiry").then(
      ({ createEnquiry }) =>
        createEnquiry({ ...input.enquiry!, consentGiven: true }),
    );
    const answer = localized(
      input.language,
      `Thank you. Your enquiry was sent to the agency. Reference: ${created.reference}.`,
    );
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "USER",
        content: maskPii(input.message),
      },
    });
    const saved = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "ASSISTANT",
        content: answer,
      },
      select: { id: true },
    });
    return streamResponse(
      answer,
      {
        conversationId: conversation.id,
        messageId: saved.id,
        enquiryReference: created.reference,
      },
      token,
    );
  }
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "USER",
      content: maskPii(input.message),
    },
  });
  let answer: string;
  let agencies: unknown[] = [];
  let source: string | null = null;
  const safetyIntent = classifySafetyIntent(input.message);
  if (safetyIntent === "injection") {
    answer = localized(
      input.language,
      "I can help with public agency information or connect you with a person, but I can't reveal hidden instructions.",
    );
  } else if (safetyIntent === "refusal") {
    answer = localized(
      input.language,
      "I can't provide legal, immigration, visa, salary, or placement guarantees. I can help with public listings or connect you with a person.",
    );
  } else if (safetyIntent === "handoff") {
    const handoff = await import("@/lib/ai/tools/request-human-handoff").then(
      ({ requestHumanHandoff }) =>
        requestHumanHandoff({
          conversationId: conversation!.id,
          visitorToken: token,
          reason: input.message.slice(0, 500),
        }),
    );
    source = handoff.handoffId;
    answer = localized(
      input.language,
      "I've asked a person to follow up. Please don't share sensitive IDs or payment details in chat.",
    );
  } else {
    const budget = await checkAiBudget();
    if (!budget.allowed) {
      answer = localized(
        input.language,
        "I can still help with directory search or request a human follow-up.",
      );
    } else {
      const [faq, directory, agency] = await Promise.all([
        getFaqAnswer({ question: input.message }).catch(() => ({
          answer: "I don't have a verified answer for that yet.",
          source: null,
          query: { question: input.message },
        })),
        input.agencySlug
          ? Promise.resolve({
              agencies: [],
              query: { city: undefined, services: [], limit: 3 },
              sponsoredListingsDisclosed: true,
            })
          : searchAgencies({
              city: extractCity(input.message),
              services: extractServices(input.message),
              limit: 3,
            }).catch(() => ({
              agencies: [],
              query: { city: undefined, services: [], limit: 3 },
              sponsoredListingsDisclosed: true,
            })),
        input.agencySlug
          ? getAgencyDetails({ slug: input.agencySlug }).catch(() => ({
              agency: null,
              query: { slug: input.agencySlug! },
            }))
          : Promise.resolve({ agency: null, query: { slug: "" } }),
      ]);
      agencies = agency.agency ? [agency.agency] : directory.agencies;
      source = faq.source;
      const agencyKnowledge = input.agencySlug
        ? await prisma.agencyAiSettings.findFirst({
            where: { agency: { slug: input.agencySlug } },
            select: { knowledgeBase: true },
          })
        : null;
      const facts = [
        faq.source ? `FAQ (${faq.source}): ${faq.answer}` : faq.answer,
        `Approved agencies: ${JSON.stringify(directory.agencies)}`,
        agency.agency
          ? `Requested agency: ${JSON.stringify(agency.agency)}`
          : "No agency-specific facts found.",
        ...(agencyKnowledge?.knowledgeBase
          ? [
              `Agency knowledge base: ${maskPii(agencyKnowledge.knowledgeBase).slice(0, 3000)}`,
            ]
          : []),
      ].join("\n");
      const initial =
        input.language === "en"
          ? "You're chatting with a FindMaids AI assistant. "
          : "AI assistant ito ng FindMaids. ";
      const chunks = streamLoggedText({
        feature: "employer_assistant",
        promptVersion: employerAssistantPromptVersion,
        maxTokens: 500,
        messages: [
          {
            role: "system",
            content: `${employerAssistantSystemPrompt}\nLanguage: ${input.language}. Only use retrieved facts below. Do not invent agencies. Ask one short follow-up question when location, helper type, budget or start date is missing. Do not ask for personal data before consent.\n${facts}`,
          },
          { role: "user", content: maskPii(input.message) },
        ],
      });
      const sponsoredNotice = directory.agencies.length
        ? " Listings marked Promoted are sponsored."
        : "";
      return streamProviderResponse({
        chunks: (async function* () {
          for await (const chunk of chunks) yield chunk;
          if (sponsoredNotice) yield sponsoredNotice;
        })(),
        fallback: `${faq.answer}${sponsoredNotice}`,
        initial,
        metadata: {
          conversationId: conversation.id,
          agencies,
          sponsoredListingsDisclosed: true,
          source,
        },
        token,
        save: async (content) =>
          (
            await prisma.message.create({
              data: {
                conversationId: conversation!.id,
                role: "ASSISTANT",
                content,
              },
              select: { id: true },
            })
          ).id,
      });
    }
  }
  const saved = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "ASSISTANT",
      content: answer,
    },
  });
  return streamResponse(
    answer,
    {
      conversationId: conversation.id,
      messageId: saved.id,
      agencies,
      sponsoredListingsDisclosed: true,
      source,
    },
    token,
  );
}
