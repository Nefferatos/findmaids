import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  checkInputLength,
  looksLikePromptInjection,
  maskPii,
} from "@/lib/ai/guardrails";
import { isFeatureEnabled } from "@/lib/ai/flags";
import { getFaqAnswer, searchAgencies } from "@/lib/ai/tools";

const schema = z.object({
  question: z.string().trim().min(3).max(1000),
  city: z.string().trim().max(100).optional(),
  services: z.array(z.string().trim().min(1).max(80)).max(10).default([]),
});

export async function GET() {
  return NextResponse.json({
    enabled: await isFeatureEnabled("employer_assistant"),
  });
}

export async function POST(request: Request) {
  if (!(await isFeatureEnabled("employer_assistant")))
    return NextResponse.json(
      { error: "The assistant is not enabled." },
      { status: 404 },
    );
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  if (!(await checkRateLimit(`assistant:${ip}`, 20, 3600)).allowed)
    return NextResponse.json(
      { error: "Please try again later." },
      { status: 429 },
    );
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !checkInputLength(parsed.data?.question ?? "", 1000))
    return NextResponse.json(
      { error: "Enter a short question." },
      { status: 400 },
    );
  if (looksLikePromptInjection(parsed.data.question))
    return NextResponse.json({
      answer:
        "I can help with agency listings and FindMaids information, but not hidden system instructions.",
      agencies: [],
    });
  const cleanQuestion = maskPii(parsed.data.question);
  const faq = await getFaqAnswer({ question: cleanQuestion });
  const directory =
    parsed.data.city || parsed.data.services.length
      ? await searchAgencies({
          city: parsed.data.city,
          services: parsed.data.services,
          limit: 6,
        })
      : null;
  const agencies = directory?.agencies ?? [];
  const answer = agencies.length
    ? `Here are approved directory listings matching your filters. Listings marked promoted are sponsored. Please contact each agency to verify current services and terms. ${faq.answer}`
    : faq.answer;
  return NextResponse.json({
    answer,
    source: faq.source,
    agencies,
    sponsoredListingsDisclosed: true,
    mode: "grounded-demo",
  });
}
