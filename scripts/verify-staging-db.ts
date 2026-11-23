import { PrismaClient } from "@/lib/generated/prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { assertStagingWriteAllowed } from "../lib/security/staging-guard";

// Read-only: compares schema.prisma models with the live public tables, vector columns/indexes and RLS.
assertStagingWriteAllowed();
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL, max: 1 }),
});

// The `prisma-client` generator does not expose `Prisma.dmmf`, so the expected
// table list is read straight from the schema: model name, overridden by `@@map`.
function expectedTables() {
  const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");
  return [...schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)]
    .map(([, name, body]) => /@@map\("([^"]+)"\)/.exec(body)?.[1] ?? name)
    .sort();
}

async function main() {
  const expected = expectedTables();
  const tables = await prisma.$queryRaw<{ name: string; rls: boolean }[]>`
    SELECT c.relname::text AS name, c.relrowsecurity AS rls
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY c.relname`;
  const actual = tables.map((t) => t.name);
  const missing = expected.filter((n) => !actual.includes(n));
  const extra = actual.filter((n) => !expected.includes(n));
  console.log(`EXPECTED=${expected.length} ACTUAL=${actual.length}`);
  console.log(`MISSING=${missing.join(", ") || "none"}`);
  console.log(`EXTRA=${extra.join(", ") || "none"}`);
  console.log(`RLS_OFF=${tables.filter((t) => !t.rls).map((t) => t.name).join(", ") || "none"}`);

  const cols = await prisma.$queryRaw<{ t: string; c: string; type: string }[]>`
    SELECT cl.relname::text AS t, a.attname::text AS c, format_type(a.atttypid, a.atttypmod)::text AS type
    FROM pg_attribute a
    JOIN pg_class cl ON cl.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    JOIN pg_type ty ON ty.oid = a.atttypid
    WHERE n.nspname = 'public' AND cl.relkind = 'r' AND ty.typname = 'vector' AND NOT a.attisdropped`;
  console.log(`VECTOR_COLUMNS=${cols.map((c) => `${c.t}.${c.c}:${c.type}`).join(", ") || "none"}`);
  const idx = await prisma.$queryRaw<{ indexname: string; method: string }[]>`
    SELECT i.indexname::text AS indexname, am.amname::text AS method FROM pg_indexes i
    JOIN pg_class ic ON ic.relname = i.indexname
    JOIN pg_am am ON am.oid = ic.relam
    WHERE i.schemaname = 'public' AND am.amname IN ('hnsw', 'ivfflat')`;
  console.log(`VECTOR_INDEXES=${idx.map((i) => `${i.indexname}(${i.method})`).join(", ") || "none"}`);
  const ext = await prisma.$queryRaw<{ extname: string; schema: string }[]>`
    SELECT e.extname::text AS extname, n.nspname::text AS schema FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'vector'`;
  console.log(`VECTOR_EXTENSION=${ext.map((e) => `${e.extname}@${e.schema}`).join(", ") || "missing"}`);
  const mig = await prisma.$queryRaw<{ migration_name: string; finished: boolean }[]>`
    SELECT migration_name, finished_at IS NOT NULL AS finished FROM _prisma_migrations ORDER BY migration_name`;
  console.log(`MIGRATIONS=${mig.length} unfinished=${mig.filter((m) => !m.finished).length}`);
}

main()
  .catch((e: unknown) => {
    const lines = e instanceof Error ? e.message.split("\n").filter((l) => l.trim()) : [];
    console.error("Verification failed:", lines.slice(0, 3).join(" | ") || "unknown");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
