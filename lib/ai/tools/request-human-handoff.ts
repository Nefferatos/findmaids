import { z } from "zod";

export const requestHumanHandoffInput = z.object({
  conversationId: z.string().min(1),
  reason: z.string().trim().min(3).max(1000),
});
export type RequestHumanHandoffInput = z.infer<typeof requestHumanHandoffInput>;

export async function requestHumanHandoff(input: RequestHumanHandoffInput) {
  const handoff = requestHumanHandoffInput.parse(input);
  return { requested: true, handoff };
}