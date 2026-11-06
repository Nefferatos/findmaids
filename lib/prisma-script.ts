/**
 * Prisma client for CLI scripts (`tsx prisma/seed.ts`, …).
 *
 * The generated client uses `engineType = "client"`, so it always needs a driver
 * adapter — `new PrismaClient()` on its own throws P2038. Scripts therefore use
 * the same adapter and schema handling as `lib/prisma.ts`.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { loadEnvFile } from "./security/staging-guard";

// CLI scripts do not run inside Next.js, so load the single .env file here.
if (existsSync(".env")) loadEnvFile(path.join(process.cwd(), ".env"));

const DEFAULT_SCHEMA = process.env.DATABASE_SCHEMA?.trim() || "findmaids";

function withSchema(connectionString: string) {
  try {
    const url = new URL(connectionString);
    if (!url.searchParams.has("schema"))
      url.searchParams.set("schema", DEFAULT_SCHEMA);
    return url.toString();
  } catch {
    return connectionString;
  }
}

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString)
  throw new Error(
    "DATABASE_URL (or DIRECT_URL) must be set before running this script.",
  );

export const prisma = new PrismaClient({
  adapter: new PrismaPg(
    { connectionString: withSchema(connectionString), max: 2 },
    // Driver adapters ignore the `schema` query parameter, so pass it here.
    { schema: DEFAULT_SCHEMA },
  ),
  log: ["error", "warn"],
});
