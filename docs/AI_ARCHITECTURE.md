# AI Architecture

## Current design

- `lib/ai/provider.ts` defines Mock, Claude, and Make adapters. Mock is selected by default. Claude requires `AI_PROVIDER=claude` and `AI_API_KEY`. Make requires `AI_PROVIDER=make` and a server-side webhook URL.
- `lib/ai/guardrails.ts` masks common contact information, checks input lengths and detects common prompt-injection language.
- `lib/ai/budget.ts` estimates PHP cost and checks monthly global/per-agency spend before model calls.
- `lib/ai/call.ts` masks prompts before provider calls and records prompt version, usage, duration, cost and status in `AiCallLog`.
- `lib/jobs/queue.ts` enqueues slow work in BullMQ when `REDIS_URL` is configured. See [JOBS.md](JOBS.md).
- `Conversation`, `Message`, `HandoffRequest`, `AgencyAiSettings`, `KnowledgeDocument` and `AiCallLog` persist conversation state, approvals and usage.

## Add a feature in five steps

1. Write a versioned prompt in `lib/ai/prompts/` and add a changelog entry. Define allowed inputs, retrieved facts, refusal conditions, and human handoff behavior.
2. Add Zod schemas and permission-checked domain tools under `lib/ai/tools/`. Tools, not model text, own all database reads/writes and consent checks.
3. Add a feature flag and budget/rate limit check. Keep the global flag disabled by default; never provide a send/publish capability to a draft-only feature.
4. Call the provider through `generateLoggedText`, pass only masked/minimized data, persist the outcome and enqueue slow work rather than blocking user flows.
5. Add unit tests, eval cases, audit/retention handling, operational documentation, then run lint, tests, typecheck and build.

## Make.com contracts

Generation POST sends `{ action: "generate", messages, model, maxTokens, temperature, tools }` and expects `{ text, inputTokens, outputTokens, toolCalls? }`. Embeddings POST sends `{ action: "embed", text, dimensions: 1536 }` to `AI_EMBEDDINGS_WEBHOOK_URL` and expects `{ embedding: number[1536] }`. Moderation sends `{ action: "moderate", text }` to `AI_WEBHOOK_URL` and expects `{ flagged, categories }`. Configure webhook authentication with `AI_WEBHOOK_SECRET`. Webhook providers must be protected and should not log raw user content.

## Known limits

Claude chat uses upstream SSE text streaming. Make.com and MockProvider currently return a complete response as one stream chunk. The chat tool loop is deterministic server orchestration; Claude tool-call iteration is not enabled. Configure and test the Make scenarios before selecting `AI_PROVIDER=make`.
