/**
 * Prisma client for the app.
 *
 * On Cloudflare Workers every PostgreSQL client is **request-scoped**: a socket
 * belongs to the request that opened it, and the runtime cancels any request that
 * touches an I/O object from an earlier request ("the Worker's code had hung").
 * A module-level pool therefore broke in two ways on the live deployment:
 *
 *  - a pooled client from request A was handed to request B, which hung until the
 *    runtime killed it (500 "Worker threw exception"); and
 *  - when the runtime cancelled a request mid-query, its checked-out client was
 *    never released, so the shared pool slowly lost every slot and the isolate
 *    served only hangs afterwards (the 40-130 ms 500s and the 404s visitors saw).
 *
 * `getCloudflareContext()` gives the per-request `ctx`, so a client (and its
 * one-socket pool) is created for that request only and never shared. A cancelled
 * request at worst wastes its own socket; later requests get a fresh client.
 * Outside a Worker (local `next dev`, `next build`, scripts) the context is
 * unavailable, so a normal cached client is used.
 */
import { PrismaClient } from "@/lib/generated/prisma/client";
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

type WorkerContext = { waitUntil?: (promise: Promise<unknown>) => void };

// One client per request. Keyed by the Workers `ctx`, which is unique per
// request and dropped when the request finishes.
const requestClients = new WeakMap<object, PrismaClient>();

function createPrismaClient(connectionString: string) {
  return new PrismaClient({
    adapter: new PrismaPg(
      {
        connectionString: withSchema(connectionString),
        // One query at a time per request, and the socket is retired as soon as
        // that query finishes, so nothing outlives the request that created it.
        max: 1,
        maxUses: 1,
        idleTimeoutMillis: 100,
        // Fail before the Workers runtime's own limits so the page can render its
        // error state instead of being killed mid-response.
        connectionTimeoutMillis: 10_000,
        statement_timeout: 8_000,
        query_timeout: 8_000,
        allowExitOnIdle: true,
      },
      {
        // Driver adapters ignore the `schema` query parameter, so pass it here.
        schema: DEFAULT_SCHEMA,
        // A socket error (for example Hyperdrive closing an idle connection) must
        // not become an unhandled `error` event that kills the request.
        onPoolError: () => {},
        onConnectionError: () => {},
      },
    ),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function connectionStringFrom(env: unknown): string | undefined {
  const hyperdrive = (env as { HYPERDRIVE?: { connectionString?: string } })
    ?.HYPERDRIVE;
  return hyperdrive?.connectionString ?? process.env.DATABASE_URL;
}

/** The client for the current request, or the shared one outside a Worker. */
export function getPrismaClient(): PrismaClient {
  // Display-only deployments and local display-only E2E runs set PRISMA_MOCK=true.
  // An empty DATABASE_URL is not reliable here because Windows shells delete
  // environment variables that are set to an empty string.
  if (process.env.PRISMA_MOCK === "true") return mockPrismaClient;

  let ctx: WorkerContext | undefined;
  let env: unknown;
  try {
    const context = getCloudflareContext();
    env = context.env;
    ctx = context.ctx as unknown as WorkerContext;
  } catch {
    // No Cloudflare request context: local Node.js, `next build`, scripts.
  }

  const connectionString = connectionStringFrom(env);
  if (!connectionString) return mockPrismaClient;

  if (!ctx) {
    if (!globalForPrisma.prisma)
      globalForPrisma.prisma = createPrismaClient(connectionString);
    return globalForPrisma.prisma;
  }

  const key = ctx as unknown as object;
  const existing = requestClients.get(key);
  if (existing) return existing;
  const client = createPrismaClient(connectionString);
  requestClients.set(key, client);
  return client;
}

/**
 * Transparent `prisma` facade that resolves the request-scoped client on every
 * access, so existing imports (`prisma.maid.findMany(...)`) keep working without
 * touching call sites.
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

