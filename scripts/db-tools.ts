/**
 * Shared helpers for scripts/db-backup.ts and scripts/db-restore.ts.
 *
 * Nothing here loads `.env` or opens a connection: the two entry scripts import
 * lib/prisma-script, which loads the single `.env` and creates the Prisma client.
 *
 * Connection details are passed to pg_dump/pg_restore as libpq environment
 * variables instead of a URL argument, so the password never appears in the
 * process list and Prisma-only query parameters (`?schema=`, `pgbouncer=true`,
 * `connection_limit=`) are never sent to the PostgreSQL client tools.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import type { PrismaClient } from "@/lib/generated/prisma/client";

export type PgTarget = {
  label: string;
  host: string;
  port: string;
  user: string;
  database: string;
  /** `user@host:port/database` — safe to print, never contains the password. */
  redacted: string;
  env: Record<string, string>;
};

export type StorageTarget = { url: string; serviceKey: string };

export type RunResult = { code: number; stdout: string; stderr: string };

export function isLocalHost(hostname: string) {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "::1" ||
    host === "[::1]" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

export function parsePgTarget(raw: string, label: string): PgTarget {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${label} is not a valid URL.`);
  }
  if (!/^postgres(ql)?:$/.test(url.protocol))
    throw new Error(`${label} must be a postgresql:// connection string.`);
  if (!url.password)
    throw new Error(
      `${label} has no password. These tools run non-interactively, so a password must be in the URL.`,
    );

  const host = url.hostname;
  const port = url.port || "5432";
  const user = decodeURIComponent(url.username);
  const database =
    decodeURIComponent(url.pathname.replace(/^\//, "")) || "postgres";
  // Supabase poolers require TLS; a local Postgres normally does not offer it.
  const sslmode =
    url.searchParams.get("sslmode") ??
    (isLocalHost(host) ? "prefer" : "require");

  return {
    label,
    host,
    port,
    user,
    database,
    redacted: `${user}@${host}:${port}/${database}`,
    env: {
      PGHOST: host,
      PGPORT: port,
      PGUSER: user,
      PGPASSWORD: decodeURIComponent(url.password),
      PGDATABASE: database,
      PGSSLMODE: sslmode,
      PGCONNECT_TIMEOUT: "15",
      PGAPPNAME: "findmaids-db-tool",
    },
  };
}
export function runBinary(
  command: string,
  args: string[],
  env: Record<string, string>,
  onStderrLine?: (line: string) => void,
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let pending = "";
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      const text = String(chunk);
      stderr += text;
      if (!onStderrLine) return;
      pending += text;
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? "";
      for (const line of lines) if (line.trim()) onStderrLine(line.trim());
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      reject(
        error.code === "ENOENT"
          ? new Error(
              `${command} was not found on PATH. Install the PostgreSQL client tools (pg_dump/pg_restore 16+) or add their bin directory to PATH.`,
            )
          : error,
      );
    });
    child.on("close", (code) => {
      if (onStderrLine && pending.trim()) onStderrLine(pending.trim());
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

export function tail(text: string, lines = 5) {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .slice(-lines)
    .join("\n");
}

export function storageFromEnv(): StorageTarget {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey)
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env to read or write a storage bucket.",
    );
  return { url, serviceKey };
}

function authHeaders(storage: StorageTarget) {
  return {
    Authorization: `Bearer ${storage.serviceKey}`,
    apikey: storage.serviceKey,
  };
}

function encodeObjectPath(objectPath: string) {
  return objectPath.split("/").map(encodeURIComponent).join("/");
}

/**
 * Creates the backup bucket as private when missing and raises its per-file
 * limit when an existing bucket is too small for this dump.
 *
 * Supabase rejects a bucket limit above the plan ceiling (HTTP 413), so the
 * requested limit is retried at 50 MB (Free plan) and finally with no explicit
 * limit, which falls back to the project-wide cap.
 */
export async function ensureBucket(
  storage: StorageTarget,
  bucket: string,
  fileSizeLimit: number,
) {
  const list = await fetch(`${storage.url}/storage/v1/bucket`, {
    headers: authHeaders(storage),
  });
  if (!list.ok)
    throw new Error(
      `Could not list storage buckets (HTTP ${list.status}). Check SUPABASE_SERVICE_ROLE_KEY.`,
    );
  const buckets = (await list.json()) as {
    id: string;
    public: boolean;
    file_size_limit: number | null;
  }[];
  const existing = buckets.find((b) => b.id === bucket);

  if (!existing) {
    const created = await createBucket(storage, bucket, fileSizeLimit);
    if (!created.ok)
      throw new Error(
        `Could not create bucket "${bucket}" (${created.detail})\n` +
          "Create it manually in Dashboard > Storage as a private bucket if the API refuses.",
      );
    return created.limit === fileSizeLimit
      ? ("created" as const)
      : (`created, limit capped at ${created.limit === null ? "plan default" : formatBytes(created.limit)}` as const);
  }

  if (existing.public)
    throw new Error(
      `Bucket "${bucket}" is public. Database dumps must live in a private bucket.`,
    );
  if (
    existing.file_size_limit === null ||
    existing.file_size_limit >= fileSizeLimit
  )
    return "existing" as const;

  const raised = await fetch(`${storage.url}/storage/v1/bucket/${bucket}`, {
    method: "PUT",
    headers: { ...authHeaders(storage), "Content-Type": "application/json" },
    body: bucketSpec(bucket, fileSizeLimit),
  });
  return raised.ok
    ? ("limit raised" as const)
    : ("existing, plan cap applies" as const);
}

function bucketSpec(bucket: string, fileSizeLimit: number | null) {
  return JSON.stringify({
    name: bucket,
    id: bucket,
    public: false,
    ...(fileSizeLimit === null ? {} : { file_size_limit: fileSizeLimit }),
  });
}

async function createBucket(
  storage: StorageTarget,
  bucket: string,
  fileSizeLimit: number,
) {
  let detail = "";
  for (const limit of [fileSizeLimit, 50 * 1024 * 1024, null] as (
    number | null
  )[]) {
    const response = await fetch(`${storage.url}/storage/v1/bucket`, {
      method: "POST",
      headers: { ...authHeaders(storage), "Content-Type": "application/json" },
      body: bucketSpec(bucket, limit),
    });
    if (response.ok) return { ok: true as const, limit };
    detail = `HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`;
    // Supabase reports the size ceiling as HTTP 400 with a 413 JSON body, so
    // every non-auth failure is retried with a lower limit; only a permission
    // problem means the request itself is wrong.
    if (response.status === 401 || response.status === 403) break;
  }
  return { ok: false as const, detail };
}

export async function uploadObject(
  storage: StorageTarget,
  bucket: string,
  key: string,
  body: Uint8Array,
  contentType: string,
) {
  const response = await fetch(
    `${storage.url}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeObjectPath(key)}`,
    {
      method: "POST",
      headers: {
        ...authHeaders(storage),
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: body as BodyInit,
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(
      `Upload of ${key} failed (HTTP ${response.status}): ${detail}\n` +
        "A 413 means the object is larger than the plan allows (50 MB per object on Supabase Free).",
    );
  }
  return `${storage.url}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeObjectPath(key)}`;
}

export async function downloadObject(
  storage: StorageTarget,
  bucket: string,
  key: string,
) {
  const response = await fetch(
    `${storage.url}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeObjectPath(key)}`,
    { headers: authHeaders(storage), cache: "no-store" },
  );
  if (!response.ok)
    throw new Error(
      `Download of ${key} failed (HTTP ${response.status}). Check the bucket name and object key.`,
    );
  return Buffer.from(await response.arrayBuffer());
}
/** Exact row counts per table; a restore is verified against these. */
export async function tableRowCounts(prisma: PrismaClient, schema: string) {
  const statements = await prisma.$queryRawUnsafe<{ q: string }[]>(
    `select format('select %L as table_name, count(*)::text as rows from %I.%I', tablename, schemaname, tablename) as q
     from pg_tables where schemaname = $1 order by tablename`,
    schema,
  );
  if (statements.length === 0) return [];
  const rows = await prisma.$queryRawUnsafe<
    { table_name: string; rows: string }[]
  >(statements.map((s) => s.q).join(" union all "));
  return rows.map((row) => ({
    table: row.table_name,
    rows: Number.parseInt(row.rows, 10) || 0,
  }));
}

export async function sha256File(file: string) {
  const hash = createHash("sha256");
  await pipeline(createReadStream(file), hash);
  return hash.digest("hex");
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}
