import { NextResponse } from "next/server";
import { getAiProvider } from "@/lib/ai/provider";
import { prisma } from "@/lib/prisma";
import IORedis from "ioredis";

export async function GET() {
  let database: "ok" | "error" = "ok";
  let redis: "ok" | "not_configured" | "error" = "not_configured";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "error";
  }

  if (process.env.REDIS_URL) {
    const client = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
      connectTimeout: 1500,
    });
    try {
      await client.connect();
      await client.ping();
      redis = "ok";
    } catch {
      redis = "error";
    } finally {
      client.disconnect();
    }
  }

  const aiProvider = getAiProvider();
  const healthy = database === "ok" && redis !== "error";

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      database,
      redis,
      queue: redis === "ok" ? "available" : "disabled",
      aiProvider: aiProvider.name,
      aiProviderConfigured:
        aiProvider.name === "mock" ||
        Boolean(process.env.AI_WEBHOOK_URL || process.env.AI_API_KEY),
    },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
