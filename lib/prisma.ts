import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import mockPrismaClient from "./prisma-mock";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// The app keeps its tables in a dedicated schema so it can share a Supabase
// database with unrelated data. Hyperdrive connection strings cannot carry the
// `?schema=` parameter reliably, so it is normalised here.
const DEFAULT_SCHEMA = process.env.DATABASE_SCHEMA?.trim() || "findmaids";

function withSchema(connectionString: string) {
  try {
    const url = new URL(connectionString);
    if (!url.searchParams.has("schema"))
      url.searchParams.set("schema", DEFAULT_SCHEMA);
    // Raw SQL ($queryRaw in rate-limit/invoices) is sent unqualified, so the
    // session search_path has to point at the app schema as well.
    if (!url.searchParams.has("options"))
      url.searchParams.set("options", `-c search_path=${DEFAULT_SCHEMA}`);
    return url.toString();
  } catch {
    return connectionString;
  }
}

function createPrismaClient() {
  let connectionString: string | undefined;

  // Workers should use Hyperdrive's pooled connection. Local Next.js keeps using
  // DATABASE_URL, and the catch also covers static generation outside a Worker.
  try {
    const runtimeEnv = getCloudflareContext().env as unknown as {
      HYPERDRIVE?: { connectionString?: string };
    };
    const hyperdrive = runtimeEnv.HYPERDRIVE;
    connectionString = hyperdrive?.connectionString;
  } catch {
    // No Cloudflare request context is available in local Node.js or static builds.
  }

  connectionString ??= process.env.DATABASE_URL;
  // Display-only deployments and local display-only E2E runs set PRISMA_MOCK=true.
  // An empty DATABASE_URL is not reliable here because Windows shells delete
  // environment variables that are set to an empty string.
  if (process.env.PRISMA_MOCK === "true" || !connectionString) {
    // Use the in-memory mock client so the app can build and run without a database.
    return mockPrismaClient;
  }

  return new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: withSchema(connectionString), max: 5 },
      // Driver adapters ignore the `schema` query parameter, so pass it here.
      { schema: DEFAULT_SCHEMA },
    ),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
