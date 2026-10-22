import { z } from "zod";

export const getFaqAnswerInput = z.object({
  question: z.string().trim().min(3).max(1000),
});
export type GetFaqAnswerInput = z.infer<typeof getFaqAnswerInput>;

export async function getFaqAnswer(input: GetFaqAnswerInput) {
  const query = getFaqAnswerInput.parse(input);
  return { answer: null, query, source: null };
}
