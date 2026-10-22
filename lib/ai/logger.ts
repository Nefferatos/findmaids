import { prisma } from "@/lib/prisma";

export type AiCallLogInput = {
  feature: string;
  model: string;
  promptVersion: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  costEstimate?: number;
  status: string;
  errorMessage?: string;
  userId?: string;
  agencyId?: string;
};

export function logAiCall(input: AiCallLogInput) {
  return prisma.aiCallLog.create({
    data: {
      ...input,
      costEstimate: input.costEstimate,
      userId: input.userId,
      agencyId: input.agencyId,
    },
  });
}