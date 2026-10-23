import {
  getAiProvider,
  type GenerateTextOptions,
  type GenerateTextResult,
} from "@/lib/ai/provider";
import { estimateCostPhp } from "@/lib/ai/budget";
import { maskPii } from "@/lib/ai/guardrails";
import { logAiCall } from "@/lib/ai/logger";

export async function generateLoggedText(
  input: GenerateTextOptions & {
    feature: string;
    promptVersion: string;
    userId?: string;
    agencyId?: string;
  },
) {
  const started = Date.now();
  const safeOptions: GenerateTextOptions = {
    ...input,
    messages: input.messages.map((message) => ({
      ...message,
      content: maskPii(message.content),
    })),
  };
  let result: GenerateTextResult | undefined;
  let errorMessage: string | undefined;
  try {
    result = await getAiProvider().generateText(safeOptions);
    return result;
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? maskPii(error.message).slice(0, 500)
        : "Unknown provider error";
    throw error;
  } finally {
    const inputTokens = result?.inputTokens ?? 0;
    const outputTokens = result?.outputTokens ?? 0;
    await logAiCall({
      feature: input.feature,
      model: input.model ?? process.env.AI_MODEL ?? "mock",
      promptVersion: input.promptVersion,
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - started,
      costEstimate: estimateCostPhp(inputTokens, outputTokens),
      status: result ? "success" : "error",
      errorMessage,
      userId: input.userId,
      agencyId: input.agencyId,
    }).catch(() => undefined);
  }
}

export async function* streamLoggedText(
  input: GenerateTextOptions & {
    feature: string;
    promptVersion: string;
    userId?: string;
    agencyId?: string;
  },
) {
  const started = Date.now();
  let text = "";
  let status = "success";
  let errorMessage: string | undefined;
  try {
    const messages = input.messages.map((message) => ({
      ...message,
      content: maskPii(message.content),
    }));
    for await (const chunk of getAiProvider().streamText({
      ...input,
      messages,
    })) {
      text += chunk;
      yield chunk;
    }
  } catch (error) {
    status = "error";
    errorMessage =
      error instanceof Error
        ? maskPii(error.message).slice(0, 500)
        : "Unknown provider error";
    throw error;
  } finally {
    const estimatedTokens = Math.ceil(text.length / 4);
    await logAiCall({
      feature: input.feature,
      model: input.model ?? process.env.AI_MODEL ?? "mock",
      promptVersion: input.promptVersion,
      inputTokens: 0,
      outputTokens: estimatedTokens,
      latencyMs: Date.now() - started,
      costEstimate: estimateCostPhp(0, estimatedTokens),
      status,
      errorMessage,
      userId: input.userId,
      agencyId: input.agencyId,
    }).catch(() => undefined);
  }
}

export async function embedLoggedText(
  text: string,
  feature: string,
  agencyId?: string,
) {
  const started = Date.now();
  let status = "success";
  let errorMessage: string | undefined;
  try {
    return await getAiProvider().embed(maskPii(text));
  } catch (error) {
    status = "error";
    errorMessage =
      error instanceof Error
        ? maskPii(error.message).slice(0, 500)
        : "Embedding provider error";
    throw error;
  } finally {
    await logAiCall({
      feature,
      model:
        process.env.AI_EMBEDDINGS_PROVIDER ?? process.env.AI_PROVIDER ?? "mock",
      promptVersion: "embedding.v1",
      inputTokens: Math.ceil(text.length / 4),
      latencyMs: Date.now() - started,
      costEstimate: 0,
      status,
      errorMessage,
      agencyId,
    }).catch(() => undefined);
  }
}

export async function moderateLoggedText(text: string, feature: string) {
  const started = Date.now();
  let status = "success";
  let errorMessage: string | undefined;
  try {
    return await getAiProvider().moderate(maskPii(text));
  } catch (error) {
    status = "error";
    errorMessage =
      error instanceof Error
        ? maskPii(error.message).slice(0, 500)
        : "Moderation provider error";
    throw error;
  } finally {
    await logAiCall({
      feature,
      model: process.env.AI_MODEL ?? process.env.AI_PROVIDER ?? "mock",
      promptVersion: "moderation.v1",
      inputTokens: Math.ceil(text.length / 4),
      latencyMs: Date.now() - started,
      costEstimate: 0,
      status,
      errorMessage,
    }).catch(() => undefined);
  }
}
