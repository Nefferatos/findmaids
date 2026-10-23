import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAiProvider } from "@/lib/ai/provider";

export const getFaqAnswerInput = z.object({
  question: z.string().trim().min(3).max(1000),
});
export type GetFaqAnswerInput = z.infer<typeof getFaqAnswerInput>;

export async function getFaqAnswer(input: GetFaqAnswerInput) {
  const query = getFaqAnswerInput.parse(input);
  const question = query.question.toLowerCase();
  const configured =
    getAiProvider().name === "mock"
      ? null
      : await prisma.adminSetting
          .findUnique({
            where: { key: "platformFaq" },
            select: { value: true },
          })
          .catch(() => null);
  const customFaq = configured?.value;
  if (
    customFaq &&
    typeof customFaq === "object" &&
    !Array.isArray(customFaq) &&
    "entries" in customFaq &&
    Array.isArray(customFaq.entries)
  ) {
    const entries = customFaq.entries.filter(
      (entry): entry is { question: string; answer: string } =>
        Boolean(
          entry &&
          typeof entry === "object" &&
          "question" in entry &&
          "answer" in entry &&
          typeof entry.question === "string" &&
          typeof entry.answer === "string",
        ),
    );
    const matched = entries.find((entry) =>
      entry.question
        .toLowerCase()
        .split(/\W+/)
        .filter((word) => word.length > 3)
        .some((word) => question.includes(word)),
    );
    if (matched)
      return { answer: matched.answer, query, source: "Platform FAQ" };
  }
  const entries = [
    {
      match: /fee|cost|price|pay/,
      answer:
        "FindMaids directory browsing is free for employers. Any service fees are set by each agency; contact the agency directly to confirm before proceeding.",
      source: "Fees and payments",
    },
    {
      match: /verify|verified|license|licence/,
      answer:
        "A verified badge means FindMaids reviewed the agency's submitted licensing information. It is not a guarantee of service quality or a substitute for your own checks.",
      source: "Agency verification",
    },
    {
      match: /contact|enquir|message/,
      answer:
        "Open an approved agency profile and use its enquiry form. Your contact details and message are sent to that agency so it can respond.",
      source: "Contacting an agency",
    },
    {
      match: /visa|immigration|legal|employment law/,
      answer:
        "I cannot provide legal, immigration, visa, or employment-law advice. Please consult a qualified professional.",
      source: "Safety policy",
    },
  ];
  const entry = entries.find((item) => item.match.test(question));
  return {
    answer:
      entry?.answer ??
      "I don't have a verified answer for that. Please review the agency profile or contact our support team.",
    query,
    source: entry?.source ?? null,
  };
}
