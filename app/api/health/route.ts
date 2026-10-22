import { NextResponse } from "next/server";
import { getAiProvider } from "@/lib/ai/provider";
import { prisma } from "@/lib/prisma";

export async function GET() {
  let database: "ok" | "error" = "ok";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "error";
  }

  return NextResponse.json(
    {
      status: database === "ok" ? "ok" : "degraded",
      database,
      aiProvider: getAiProvider().name,
    },
    { status: database === "ok" ? 200 : 503 },
  );
}
