import { z } from "zod";

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};
export type GenerateTextOptions = {
  messages: ChatMessage[];
  maxTokens?: number;
  model?: string;
  temperature?: number;
  tools?: AiToolDefinition[];
};
export type GenerateTextResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
  toolCalls?: { name: string; input: unknown }[];
};
export type EmbedResult = { embedding: number[] };
export type ModerationResult = { flagged: boolean; categories: string[] };
export type AiToolDefinition = {
  name: string;
  description: string;
  inputSchema: z.ZodType;
};

export interface AiProvider {
  readonly name: string;
  generateText(options: GenerateTextOptions): Promise<GenerateTextResult>;
  streamText(options: GenerateTextOptions): AsyncIterable<string>;
  embed(text: string): Promise<EmbedResult>;
  moderate(text: string): Promise<ModerationResult>;
}

const embeddingDimension = Number(process.env.AI_EMBEDDING_DIMENSIONS ?? 1536);
const mockText =
  "You're chatting with a FindMaids AI assistant. I can help with public directory information or connect you with a person.";

export class MockProvider implements AiProvider {
  readonly name = "mock";
  async generateText(
    _options: GenerateTextOptions,
  ): Promise<GenerateTextResult> {
    void _options;
    return { text: mockText, inputTokens: 0, outputTokens: 0 };
  }
  async *streamText(options: GenerateTextOptions): AsyncIterable<string> {
    const result = await this.generateText(options);
    yield result.text;
  }
  async embed(text: string): Promise<EmbedResult> {
    const embedding = Array.from({ length: embeddingDimension }, () => 0);
    for (let index = 0; index < text.length; index++)
      embedding[index % embeddingDimension] += text.charCodeAt(index) / 65535;
    const magnitude =
      Math.sqrt(embedding.reduce((sum, value) => sum + value * value, 0)) || 1;
    return { embedding: embedding.map((value) => value / magnitude) };
  }
  async moderate(text: string): Promise<ModerationResult> {
    const categories = [
      ...(/\b(?:kill|hurt|threaten)\b/i.test(text) ? ["violence"] : []),
      ...(/\b(?:idiot|stupid|hate you)\b/i.test(text) ? ["abuse"] : []),
      ...(/\b\d{9,}\b/.test(text) ? ["personal_information"] : []),
    ];
    return { flagged: categories.length > 0, categories };
  }
}

const claudeResponseSchema = z
  .object({
    content: z.array(
      z
        .object({
          type: z.string(),
          text: z.string().optional(),
          name: z.string().optional(),
          input: z.unknown().optional(),
        })
        .passthrough(),
    ),
    usage: z
      .object({
        input_tokens: z.number().default(0),
        output_tokens: z.number().default(0),
      })
      .default({ input_tokens: 0, output_tokens: 0 }),
  })
  .passthrough();

async function requestWithRetry(
  url: string,
  init: RequestInit,
  timeoutMs = 15000,
  retries = 2,
) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        cache: "no-store",
      });
      if (response.ok) return response;
      const body = await response.text();
      if (response.status < 500 && response.status !== 429)
        throw new Error(`AI provider returned ${response.status}.`);
      lastError = new Error(
        `AI provider returned ${response.status}: ${body.slice(0, 200)}`,
      );
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
    } finally {
      clearTimeout(timer);
    }
    await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** attempt));
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("AI provider request failed.");
}

function requireClaudeKey() {
  const key = process.env.AI_API_KEY;
  if (!key) throw new Error("AI_API_KEY is required when AI_PROVIDER=claude.");
  return key;
}

function toClaudeMessages(messages: ChatMessage[]) {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  return {
    system,
    messages: messages
      .filter((message) => message.role !== "system")
      .map(({ role, content }) => ({ role, content })),
  };
}

export class ClaudeProvider implements AiProvider {
  readonly name = "claude";
  readonly model = process.env.AI_MODEL ?? "claude-3-5-sonnet-latest";
  readonly maxTokens = Number(process.env.AI_MAX_TOKENS ?? 1024);
  readonly temperature = Number(process.env.AI_TEMPERATURE ?? 0.2);
  readonly baseUrl =
    process.env.CLAUDE_API_URL ?? "https://api.anthropic.com/v1/messages";

  async generateText(
    options: GenerateTextOptions,
  ): Promise<GenerateTextResult> {
    const { system, messages } = toClaudeMessages(options.messages);
    const response = await requestWithRetry(
      this.baseUrl,
      {
        method: "POST",
        headers: {
          "x-api-key": requireClaudeKey(),
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: options.model ?? this.model,
          max_tokens: options.maxTokens ?? this.maxTokens,
          temperature: options.temperature ?? this.temperature,
          ...(system ? { system } : {}),
          messages,
          ...(options.tools?.length
            ? {
                tools: options.tools.map((tool) => ({
                  name: tool.name,
                  description: tool.description,
                  input_schema: z.toJSONSchema(tool.inputSchema),
                })),
              }
            : {}),
        }),
        signal: undefined,
      },
      Number(process.env.AI_TIMEOUT_MS ?? 15000),
    );
    const parsed = claudeResponseSchema.parse(await response.json());
    return {
      text: parsed.content
        .filter((block) => block.type === "text")
        .map((block) => block.text ?? "")
        .join(""),
      inputTokens: parsed.usage.input_tokens,
      outputTokens: parsed.usage.output_tokens,
      toolCalls: parsed.content
        .filter((block) => block.type === "tool_use" && block.name)
        .map((block) => ({ name: block.name!, input: block.input })),
    };
  }

  async *streamText(options: GenerateTextOptions): AsyncIterable<string> {
    const { system, messages } = toClaudeMessages(options.messages);
    const response = await requestWithRetry(
      this.baseUrl,
      {
        method: "POST",
        headers: {
          "x-api-key": requireClaudeKey(),
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: options.model ?? this.model,
          max_tokens: options.maxTokens ?? this.maxTokens,
          temperature: options.temperature ?? this.temperature,
          stream: true,
          ...(system ? { system } : {}),
          messages,
        }),
      },
      Number(process.env.AI_TIMEOUT_MS ?? 15000),
    );
    if (!response.body) throw new Error("Claude streaming response has no body.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const event of events) {
          const data = event.split("\n").find((line) => line.startsWith("data: "))?.slice(6);
          if (!data || data === "[DONE]") continue;
          const parsed: unknown = JSON.parse(data);
          if (!parsed || typeof parsed !== "object") continue;
          const eventData = parsed as { type?: string; delta?: { type?: string; text?: string }; error?: { message?: string } };
          if (eventData.type === "error") throw new Error(eventData.error?.message ?? "Claude stream failed.");
          if (eventData.type === "content_block_delta" && eventData.delta?.type === "text_delta" && eventData.delta.text) yield eventData.delta.text;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async embed(text: string): Promise<EmbedResult> {
    const url =
      process.env.AI_EMBEDDINGS_WEBHOOK_URL ?? process.env.AI_WEBHOOK_URL;
    if (!url)
      throw new Error(
        "Configure AI_EMBEDDINGS_WEBHOOK_URL for Make.com embeddings.",
      );
    return callEmbeddingWebhook(url, text);
  }

  async moderate(text: string): Promise<ModerationResult> {
    const result = await this.generateText({
      model: process.env.AI_MODEL ?? this.model,
      maxTokens: 100,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "Classify this text for spam, abuse, threats and personal information. Return only JSON with boolean flagged and string[] categories. Never repeat input text.",
        },
        { role: "user", content: text },
      ],
    });
    try {
      const parsed = z
        .object({ flagged: z.boolean(), categories: z.array(z.string()) })
        .parse(JSON.parse(result.text));
      return parsed;
    } catch {
      return { flagged: true, categories: ["classifier_unavailable"] };
    }
  }
}

async function callEmbeddingWebhook(
  url: string,
  text: string,
): Promise<EmbedResult> {
  const token = process.env.AI_WEBHOOK_SECRET;
  const response = await requestWithRetry(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        action: "embed",
        text,
        dimensions: embeddingDimension,
      }),
    },
    Number(process.env.AI_TIMEOUT_MS ?? 15000),
  );
  const parsed = z
    .object({ embedding: z.array(z.number()).length(embeddingDimension) })
    .parse(await response.json());
  return parsed;
}

export class MakeWebhookProvider implements AiProvider {
  readonly name = "make";
  readonly webhookUrl = process.env.AI_WEBHOOK_URL ?? "";
  async generateText(
    options: GenerateTextOptions,
  ): Promise<GenerateTextResult> {
    if (!this.webhookUrl)
      throw new Error("AI_WEBHOOK_URL is required when AI_PROVIDER=make.");
    const token = process.env.AI_WEBHOOK_SECRET;
    const response = await requestWithRetry(
      this.webhookUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: "generate", ...options }),
      },
      Number(process.env.AI_TIMEOUT_MS ?? 15000),
    );
    return z
      .object({
        text: z.string(),
        inputTokens: z.number().default(0),
        outputTokens: z.number().default(0),
        toolCalls: z
          .array(z.object({ name: z.string(), input: z.unknown() }))
          .optional(),
      })
      .parse(await response.json());
  }
  async *streamText(options: GenerateTextOptions): AsyncIterable<string> {
    const result = await this.generateText(options);
    yield result.text;
  }
  async embed(text: string): Promise<EmbedResult> {
    if (!process.env.AI_EMBEDDINGS_WEBHOOK_URL)
      throw new Error(
        "AI_EMBEDDINGS_WEBHOOK_URL is required for Make.com embeddings.",
      );
    return callEmbeddingWebhook(process.env.AI_EMBEDDINGS_WEBHOOK_URL, text);
  }
  async moderate(text: string): Promise<ModerationResult> {
    if (!this.webhookUrl)
      throw new Error("AI_WEBHOOK_URL is required when AI_PROVIDER=make.");
    const response = await requestWithRetry(
      this.webhookUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.AI_WEBHOOK_SECRET
            ? { Authorization: `Bearer ${process.env.AI_WEBHOOK_SECRET}` }
            : {}),
        },
        body: JSON.stringify({ action: "moderate", text }),
      },
      Number(process.env.AI_TIMEOUT_MS ?? 15000),
    );
    return z
      .object({ flagged: z.boolean(), categories: z.array(z.string()) })
      .parse(await response.json());
  }
}

export function getAiProvider(): AiProvider {
  switch (process.env.AI_PROVIDER?.toLowerCase()) {
    case "claude":
      return process.env.AI_API_KEY ? new ClaudeProvider() : new MockProvider();
    case "make":
      return new MakeWebhookProvider();
    case "mock":
    case undefined:
    case "":
      return new MockProvider();
    default:
      throw new Error(`Unsupported AI_PROVIDER: ${process.env.AI_PROVIDER}`);
  }
}
