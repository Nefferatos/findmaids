export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };
export type GenerateTextOptions = { messages: ChatMessage[]; maxTokens?: number; model?: string };
export type GenerateTextResult = { text: string; inputTokens: number; outputTokens: number };
export type EmbedResult = { embedding: number[] };
export type ModerationResult = { flagged: boolean; categories: string[] };

export interface AiProvider {
  readonly name: string;
  generateText(options: GenerateTextOptions): Promise<GenerateTextResult>;
  streamText(options: GenerateTextOptions): AsyncIterable<string>;
  embed(text: string): Promise<EmbedResult>;
  moderate(text: string): Promise<ModerationResult>;
}

export class MockProvider implements AiProvider {
  readonly name = "mock";

  async generateText(_options: GenerateTextOptions): Promise<GenerateTextResult> {
    void _options;
    const text = "I am FindMaids' AI assistant. I can help you explore agency information. For specific advice, I can connect you with a person.";
    return { text, inputTokens: 0, outputTokens: 0 };
  }

  async *streamText(options: GenerateTextOptions): AsyncIterable<string> {
    const result = await this.generateText(options);
    yield result.text;
  }

  async embed(_text: string): Promise<EmbedResult> {
    void _text;
    return { embedding: Array.from({ length: 1536 }, () => 0) };
  }

  async moderate(_text: string): Promise<ModerationResult> {
    void _text;
    return { flagged: false, categories: [] };
  }
}

export class ClaudeProvider implements AiProvider {
  readonly name = "claude";
  readonly apiKey = process.env.AI_API_KEY ?? "";
  readonly model = process.env.AI_MODEL ?? "claude-3-5-sonnet-latest";

  async generateText(_options: GenerateTextOptions): Promise<GenerateTextResult> {
    void _options;
    throw new Error("ClaudeProvider is a configuration placeholder; live AI calls are not enabled.");
  }

  async *streamText(_options: GenerateTextOptions): AsyncIterable<string> {
    void _options;
    throw new Error("ClaudeProvider is a configuration placeholder; live AI calls are not enabled.");
  }

  async embed(_text: string): Promise<EmbedResult> {
    void _text;
    throw new Error("Claude embedding calls are not configured.");
  }

  async moderate(_text: string): Promise<ModerationResult> {
    void _text;
    throw new Error("Claude moderation calls are not configured.");
  }
}

export class MakeWebhookProvider implements AiProvider {
  readonly name = "make";
  readonly webhookUrl = process.env.AI_WEBHOOK_URL ?? "";

  async generateText(_options: GenerateTextOptions): Promise<GenerateTextResult> {
    void _options;
    throw new Error("Make.com integration is not configured for live calls.");
  }

  async *streamText(_options: GenerateTextOptions): AsyncIterable<string> {
    void _options;
    throw new Error("Make.com webhooks do not provide streaming in this foundation.");
  }

  async embed(_text: string): Promise<EmbedResult> {
    void _text;
    throw new Error("Embedding is not configured for the Make.com provider.");
  }

  async moderate(_text: string): Promise<ModerationResult> {
    void _text;
    throw new Error("Moderation is not configured for the Make.com provider.");
  }
}

export function getAiProvider(): AiProvider {
  switch (process.env.AI_PROVIDER?.toLowerCase()) {
    case "claude":
      return new ClaudeProvider();
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