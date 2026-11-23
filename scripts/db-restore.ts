import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../lib/prisma-script";
import { assertStagingWriteAllowed } from "../lib/security/staging-guard";
import {
  downloadObject,
  formatBytes,
  isLocalHost,
  parsePgTarget,
  runBinary,
  storageFromEnv,
  tableRowCounts,
  tail,
} from "./db-tools";

// Restores a pg_dump archive created by scripts/db-backup.ts.
//
//   npm run db:restore -- --file=backups/findmaids-public-<stamp>.dump --confirm=<target host>
//   npm run db:restore -- --key=db/public/<stamp>/findmaids-public-<stamp>.dump --confirm=<host>
//
// An explicit --confirm=<host> is required so a mistyped target cannot be
// overwritten. Non-local targets also go through lib/security/staging-guard.ts:
// APP_ENV must be staging/test and STAGING_PROJECT_REF must appear in both
// database URLs. Overwriting production follows docs/BACKUP_RESTORE.md.
//
// Storage objects (media/private buckets) are not part of a database dump.
const DEFAULT_BUCKET = "findmaids-backups";

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const option = (name: string) => {
  const hit = argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};

function usage() {
  console.log(
    [
      "Usage: npm run db:restore -- (--file=<archive> | --key=<bucket key>) --confirm=<host>",
      "",
      "  --file=<path>      local .dump archive from npm run db:backup",
      "  --key=<object>     archive key inside the storage bucket (downloaded first)",
      "  --bucket=<name>    storage bucket (default: SUPABASE_BACKUP_BUCKET or findmaids-backups)",
      "  --target=<name>    DIRECT_URL (default) or DATABASE_URL",
      "  --schema=<name>    schema to verify (default: DATABASE_SCHEMA or findmaids)",
      "  --drop-existing    drop objects first (pg_restore --clean --if-exists)",
      "  --strict           abort on the first error (pg_restore --exit-on-error)",
      "  --confirm=<host>   required; must equal the target host, e.g. 127.0.0.1",
    ].join("\n"),
  );
}
async function main() {
  if (flag("help")) return usage();

  const schema =
    option("schema") ?? (process.env.DATABASE_SCHEMA?.trim() || "findmaids");
  const targetLabel = option("target") ?? "DIRECT_URL";
  const rawTarget =
    targetLabel === "DATABASE_URL"
      ? process.env.DATABASE_URL?.trim()
      : process.env.DIRECT_URL?.trim();
  if (!rawTarget) throw new Error(`${targetLabel} is not set in .env.`);
  const target = parsePgTarget(rawTarget, targetLabel);

  if (option("confirm") !== target.host)
    throw new Error(
      `Refusing to restore without --confirm=${target.host} (the host the target URL resolves to).`,
    );

  console.log(`Target   ${target.redacted} (${targetLabel})`);
  console.log(`Schema   ${schema}`);
  if (isLocalHost(target.host)) {
    console.log("Guard    local database, staging guard not required");
  } else {
    assertStagingWriteAllowed();
    console.log("Guard    staging/test write guard passed");
  }

  const bucket =
    option("bucket") ??
    process.env.SUPABASE_BACKUP_BUCKET?.trim() ??
    DEFAULT_BUCKET;
  const outDir = path.resolve(option("out") ?? "backups");
  let file = option("file");
  const key = option("key");
  if (key) {
    const storage = storageFromEnv();
    await mkdir(outDir, { recursive: true });
    const body = await downloadObject(storage, bucket, key);
    file = path.join(outDir, path.basename(key));
    await writeFile(file, body);
    console.log(`Fetched  ${key} (${formatBytes(body.byteLength)}) -> ${file}`);
  }
  if (!file)
    throw new Error(
      "Pass --file=<path> or --key=<bucket object key>. Use --help for options.",
    );

  const dumpPath = path.resolve(file);
  if (!existsSync(dumpPath)) throw new Error(`Archive not found: ${dumpPath}`);
  const bytes = (await stat(dumpPath)).size;
  console.log(`Archive  ${dumpPath} (${formatBytes(bytes)})`);

  const manifestPath = dumpPath.replace(/\.dump$/, "-manifest.json");
  const expected = existsSync(manifestPath)
    ? (JSON.parse(await readFile(manifestPath, "utf8")) as {
        totalRows?: number;
        tables?: { table: string; rows: number }[];
      })
    : undefined;
  if (expected)
    console.log(
      `Manifest ${path.basename(manifestPath)}: ${expected.tables?.length ?? "?"} tables, ${expected.totalRows ?? "?"} rows`,
    );

  // The Prisma client is bound to DIRECT_URL/DATABASE_URL from .env, so the
  // extension check and row-count verification only make sense when the chosen
  // target is that same database.
  let canVerify = false;
  try {
    const envUrl =
      process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim() || "";
    canVerify =
      envUrl !== "" && parsePgTarget(envUrl, "env").host === target.host;
  } catch {
    canVerify = false;
  }
  if (canVerify) {
    try {
      await prisma.$executeRawUnsafe(
        "create extension if not exists vector with schema extensions",
      );
    } catch (error) {
      console.warn(
        `vector extension not ensured: ${
          error instanceof Error
            ? error.message.split("\n")[0]
            : "unknown error"
        }\n  Enable "vector" under Database > Extensions in the target project if the restore fails on vector columns.`,
      );
    }
  } else {
    console.log(
      "Note     target differs from DIRECT_URL/DATABASE_URL; extension check and verification are skipped",
    );
  }

  const args = ["--no-owner", "--no-privileges", `--dbname=${target.database}`];
  if (flag("drop-existing")) args.push("--clean", "--if-exists");
  if (flag("strict")) args.push("--exit-on-error");
  args.push(dumpPath);

  const errors: string[] = [];
  console.log("\nRestoring ...");
  const restore = await runBinary("pg_restore", args, target.env, (line) => {
    if (/\berror\b/i.test(line)) errors.push(line);
  });
  if (restore.code !== 0)
    throw new Error(
      `pg_restore failed (exit ${restore.code}):\n${tail(restore.stderr, 10)}`,
    );

  if (errors.length > 0) {
    console.error(
      `\nRestore finished with ${errors.length} error line(s). First 10:`,
    );
    for (const line of errors.slice(0, 10)) console.error(`  ${line}`);
    console.error(
      "Existing objects cause this; re-run with --drop-existing on a target you may overwrite.",
    );
    process.exitCode = 1;
  }

  if (canVerify && errors.length === 0) {
    const actual = await tableRowCounts(prisma, schema);
    const actualRows = actual.reduce((sum, table) => sum + table.rows, 0);
    console.log(
      `\nVerified ${actual.length} tables, ${actualRows} rows in the target database.`,
    );
    if (expected?.tables) {
      const mismatched = expected.tables
        .map((table) => ({
          ...table,
          actual: actual.find((a) => a.table === table.table)?.rows ?? 0,
        }))
        .filter((table) => table.actual !== table.rows);
      if (mismatched.length > 0) {
        for (const table of mismatched.slice(0, 10))
          console.error(
            `  MISMATCH ${table.table}: expected ${table.rows}, found ${table.actual}`,
          );
        process.exitCode = 1;
      } else {
        console.log("Row counts match the backup manifest.");
      }
    }
  }

  console.log(
    [
      "",
      "Next steps:",
      "  npx prisma migrate status",
      "  npx --no-install tsx scripts/verify-staging-db.ts      (staging only)",
      "  Storage objects (findmaids-media / findmaids-private) are NOT part of a dump;",
      "  copy those files separately if you are moving to another project.",
    ].join("\n"),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Restore failed.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
