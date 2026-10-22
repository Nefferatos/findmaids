import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
) {
  const safeKey = createHash("sha256").update(key).digest("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowSeconds * 1000);
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "RateLimitBucket" ("key", "count", "expiresAt", "createdAt", "updatedAt")
    VALUES (${safeKey}, 1, ${expiresAt}, ${now}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "expiresAt" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN ${expiresAt} ELSE "RateLimitBucket"."expiresAt" END,
      "updatedAt" = ${now}
    RETURNING "count"
  `;
  return {
    allowed: (rows[0]?.count ?? limit + 1) <= limit,
    remaining: Math.max(0, limit - (rows[0]?.count ?? limit + 1)),
  };
}
