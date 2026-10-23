import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isFeatureEnabled } from "@/lib/ai/flags";
import { moderateLoggedText } from "@/lib/ai/call";
import { checkAiBudget } from "@/lib/ai/budget";
import { maskPii } from "@/lib/ai/guardrails";

const profanity = ["fuck", "shit", "bitch", "asshole"];
const urlPattern = /(?:https?:\/\/|www\.)\S+/i;

export function normalizeModerationText(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

export function moderateText(input: { title?: string; body: string }) {
  const text = normalizeModerationText(`${input.title ?? ""} ${input.body}`);
  const flags: string[] = [];
  if (urlPattern.test(text)) flags.push("LINK");
  if (profanity.some((word) => new RegExp(`\\b${word}\\b`, "i").test(text)))
    flags.push("PROFANITY");
  return { flags, clean: flags.length === 0 };
}

export function hashBlockValue(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export async function hasBlockedPattern(values: {
  email?: string | null;
  phone?: string | null;
  ip?: string | null;
}) {
  const candidates = [
    ...(values.email
      ? [{ type: "EMAIL", hash: hashBlockValue(values.email) }]
      : []),
    ...(values.phone
      ? [{ type: "PHONE", hash: hashBlockValue(values.phone) }]
      : []),
    ...(values.ip ? [{ type: "IP", hash: hashBlockValue(values.ip) }] : []),
  ];
  if (!candidates.length) return false;
  const entry = await prisma.blockList.findFirst({
    where: {
      active: true,
      OR: candidates.map((candidate) => ({
        type: candidate.type,
        valueHash: candidate.hash,
      })),
    },
    select: { id: true },
  });
  return Boolean(entry);
}

export async function reviewFlags(review: {
  title: string;
  body: string;
  id?: string;
  reviewerEmail?: string | null;
  authorIpHash?: string | null;
}) {
  const result = moderateText(review);
  if (review.id) {
    const duplicate = await prisma.review.findFirst({
      where: {
        id: { not: review.id },
        OR: [
          { title: review.title, body: review.body },
          {
            body: {
              equals: normalizeModerationText(review.body),
              mode: "insensitive",
            },
          },
        ],
      },
      select: { id: true },
    });
    if (duplicate) result.flags.push("DUPLICATE_TEXT");
    if (review.reviewerEmail) {
      const sameEmail = await prisma.review.findFirst({
        where: { id: { not: review.id }, reviewerEmail: review.reviewerEmail },
        select: { id: true },
      });
      if (sameEmail) result.flags.push("REPEATED_EMAIL");
    }
    if (review.authorIpHash) {
      const sameIp = await prisma.review.findFirst({
        where: {
          id: { not: review.id },
          authorIpHash: review.authorIpHash,
          createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) },
        },
        select: { id: true },
      });
      if (sameIp) result.flags.push("REPEATED_IP");
    }
  }
  let ai: {
    flagged: boolean;
    categories: string[];
    confidence: number;
  } | null = null;
  const enabled = await isFeatureEnabled("review_moderation_assist").catch(
    () => false,
  );
  const budget = enabled
    ? await checkAiBudget().catch(() => ({ allowed: false }))
    : { allowed: false };
  if (enabled && budget.allowed) {
    try {
      const content = maskPii(`${review.title}\n${review.body}`).slice(0, 3000);
      const classified = await moderateLoggedText(content, "review_moderation");
      ai = { ...classified, confidence: classified.flagged ? 0.75 : 0.5 };
    } catch {
      ai = null;
    }
  }
  if (ai?.flagged)
    result.flags.push(
      ...ai.categories.map((category) => `AI_${category.toUpperCase()}`),
    );
  return {
    ...result,
    ai,
    decision: "human_review_required" as const,
    clean: result.flags.length === 0,
  };
}
