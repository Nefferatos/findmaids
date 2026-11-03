import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { assertStagingWriteAllowed } from "../lib/security/staging-guard";

// Staging only: clears rate-limit counters so repeated dry runs are not blocked by earlier attempts.
assertStagingWriteAllowed();
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL, max: 1 }) });

prisma.rateLimitBucket
  .deleteMany({})
  .then((r) => console.log(`Cleared ${r.count} rate-limit bucket(s).`))
  .catch((e: unknown) => {
    console.error("Failed:", e instanceof Error ? e.message.split("\n")[0] : "unknown");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
