/**
 * Prisma client for the app.
 *
 * Workers sockets belong to the request that opened them, so the pool must never
 * hand a connection from one request to another: the second request waits on an
 * I/O object the runtime has already released and is cancelled as "the Worker's
 * code had hung" (which is what turned live maid pages into 500s and, on the
 * detail routes that mapped a failed query to notFound(), into 404s).
 *
 * One client is created per isolate, lazily, on the first database access
 * inside a request:
 *
 *  - `maxUses: 1` retires a socket after a single query, so a request can never
 *    inherit a socket another request opened;
 *  - `max: 5` lets the few queries of one render run in parallel instead of
 *    queueing behind a single slot (that queueing produced pg's "timeout
 *    exceeded when trying to connect" and empty public pages);
 *  - resolving the connection string on first use means `getCloudflareContext()`
 *    runs inside the request, where HYPERDRIVE is available. Creating a
 *    PrismaClient for every request instead costs more than the Workers Free
 *    plan's 10 ms CPU budget and turns ordinary page views into 503s
 *    (Cloudflare error 1102).
 */
import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import mockPrismaClient from "./prisma-mock";

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

function createPrismaClient(connectionString?: string) {
  if (!connectionString) return mockPrismaClient;
  return new PrismaClient({
    adapter: new PrismaPg(
      {
        connectionString: withSchema(connectionString),
        max: 5,
        maxUses: 1,
        idleTimeoutMillis: 100,
        // Fail before the Workers runtime's own limits so the page can render its
        // error state instead of being killed mid-response.
        connectionTimeoutMillis: 12_000,
        statement_timeout: 8_000,
        query_timeout: 8_000,
        allowExitOnIdle: true,
      },
      {
        // Driver adapters ignore the `schema` query parameter, so pass it here.
        schema: DEFAULT_SCHEMA,
        // A socket error (Hyperdrive closing an idle connection, for example)
        // must not surface as an unhandled `error` event that fails the request.
        onPoolError: () => {},
        onConnectionError: () => {},
      },
    ),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function resolveConnectionString(): string | undefined {
  try {
    const runtimeEnv = getCloudflareContext().env as unknown as {
      HYPERDRIVE?: { connectionString?: string };
    };
    const hyperdrive = runtimeEnv.HYPERDRIVE?.connectionString;
    if (hyperdrive) return hyperdrive;
  } catch {
    // No Cloudflare request context is available in local Node.js or static builds.
  }
  // Display-only deployments set PRISMA_MOCK=true; an empty DATABASE_URL is not
  // reliable on Windows because the shell deletes variables set to "".
  if (process.env.PRISMA_MOCK === "true") return undefined;
  return process.env.DATABASE_URL;
}

let isolateClient: PrismaClient | null = null;

/**
 * The client for this Worker isolate, created on first use.
 *
 * The first call happens inside a request, so Hyperdrive is resolved from the
 * live Cloudflare context. `PRISMA_MOCK=true` and a missing connection string
 * fall back to the in-memory client (local UI work and display builds).
 */
export function getPrismaClient(): PrismaClient {
  if (isolateClient) return isolateClient;
  if (process.env.PRISMA_MOCK === "true") return mockPrismaClient;
  const connectionString = resolveConnectionString();
  if (!connectionString) return mockPrismaClient;
  isolateClient = createPrismaClient(connectionString);
  return isolateClient;
}

/**
 * Transparent facade that resolves the isolate client on first access, so
 * existing imports (`prisma.maid.findMany(...)`) keep working without touching
 * call sites.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient() as unknown as Record<PropertyKey, unknown>;
    const value = client[property];
    return typeof value === "function" ? value.bind(client) : value;
  },
  has(_target, property) {
    const client = getPrismaClient() as unknown as object;
    return property in client;
  },
});
