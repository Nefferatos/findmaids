import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../lib/prisma-script";
import {
  ensureBucket,
  formatBytes,
  parsePgTarget,
  runBinary,
  sha256File,
  storageFromEnv,
  tableRowCounts,
  tail,
  uploadObject,
} from "./db-tools";

// Copies the live database into a compressed pg_dump archive on disk and, by
// default, uploads the archive plus a manifest to a private Supabase Storage
// bucket. Read-only against the database, so it is safe on any environment.
//
//   npm run db:backup                         # dump + upload
//   npm run db:backup -- --no-upload          # dump only (kept in ./backups)
//   npm run db:backup -- --schema=public --bucket=findmaids-backups
//
// `prisma migrate` is NOT used here: Prisma migrations only create or alter the
// schema. Copying rows requires pg_dump/pg_restore.
const DEFAULT_BUCKET = "findmaids-backups";
// Supabase rejects anything above the plan limit (50 MB per object on Free);
// the bucket is created with a larger ceiling so paid plans work unchanged.
const MAX_OBJECT_BYTES = 512 * 1024 * 1024;

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const option = (name: string) => {
  const hit = argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};

function usage() {
  console.log(
    [
      "Usage: npm run db:backup [-- options]",
      "",
      "  --schema=<name>    schema to dump (default: DATABASE_SCHEMA or findmaids)",
      "  --out=<dir>        local output directory (default: ./backups)",
      "  --bucket=<name>    storage bucket (default: SUPABASE_BACKUP_BUCKET or findmaids-backups)",
      "  --no-upload        keep the archive locally and skip Supabase Storage",
      "  --delete-local     remove the local archive after a successful upload",
    ].join("\n"),
  );
}
async function main() {
  if (flag("help")) return usage();

  const schema =
    option("schema") ?? (process.env.DATABASE_SCHEMA?.trim() || "findmaids");
  const rawUrl =
    process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
  const label = process.env.DIRECT_URL?.trim() ? "DIRECT_URL" : "DATABASE_URL";
  if (!rawUrl)
    throw new Error(
      "Set DIRECT_URL (session pooler, port 5432) or DATABASE_URL in .env before backing up.",
    );
  // The session pooler is the correct endpoint for pg_dump; the transaction
  // pooler on 6543 breaks long-running dumps.
  const source = parsePgTarget(rawUrl, label);

  console.log(`Source   ${source.redacted} (${label})`);
  console.log(`Schema   ${schema}`);

  const [{ version }] =
    await prisma.$queryRawUnsafe<{ version: string }[]>("select version()");
  const [{ dbSize }] = await prisma.$queryRawUnsafe<{ dbSize: string }[]>(
    'select pg_size_pretty(pg_database_size(current_database())) as "dbSize"',
  );
  const serverMajor = Number(/PostgreSQL (\d+)/.exec(version)?.[1] ?? 0);

  const probe = await runBinary("pg_dump", ["--version"], {});
  const clientMajor = Number(
    /pg_dump \(PostgreSQL\) (\d+)/.exec(probe.stdout)?.[1] ?? 0,
  );
  if (serverMajor && clientMajor && serverMajor > clientMajor)
    throw new Error(
      `pg_dump ${clientMajor} cannot dump a PostgreSQL ${serverMajor} server. Upgrade the PostgreSQL client tools.`,
    );
  console.log(
    `Server   PostgreSQL ${serverMajor || "unknown"}, database size ${dbSize}`,
  );
  console.log(`pg_dump  ${probe.stdout.trim()}`);

  const outDir = path.resolve(option("out") ?? "backups");
  await mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = `findmaids-${schema}-${stamp}`;
  const dumpPath = path.join(outDir, `${base}.dump`);
  const manifestPath = path.join(outDir, `${base}-manifest.json`);

  console.log(`\nDumping to ${dumpPath} ...`);
  const dump = await runBinary(
    "pg_dump",
    [
      "--format=custom",
      "-Z",
      "6",
      `--schema=${schema}`,
      "--no-owner",
      "--no-privileges",
      "--lock-wait-timeout=30s",
      `--file=${dumpPath}`,
    ],
    source.env,
  );
  if (dump.code !== 0)
    throw new Error(
      `pg_dump failed (exit ${dump.code}):\n${tail(dump.stderr, 10)}`,
    );
  const bytes = (await stat(dumpPath)).size;
  const sha256 = await sha256File(dumpPath);
  const tables = await tableRowCounts(prisma, schema);
  const totalRows = tables.reduce((sum, table) => sum + table.rows, 0);
  const pkg = JSON.parse(
    await readFile(path.join(process.cwd(), "package.json"), "utf8"),
  ) as { version?: string };

  const manifest = {
    kind: "findmaids-db-backup",
    createdAt: new Date().toISOString(),
    appVersion: pkg.version ?? "unknown",
    source: {
      label,
      host: source.host,
      port: source.port,
      database: source.database,
      schema,
    },
    postgresVersion: version,
    pgDumpVersion: probe.stdout.trim(),
    databaseSize: dbSize,
    dump: { file: path.basename(dumpPath), format: "custom", bytes, sha256 },
    tables,
    totalRows,
  };
  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(manifestPath, manifestJson, "utf8");

  console.log(`\nWrote ${path.basename(dumpPath)} (${formatBytes(bytes)})`);
  console.log(
    `      ${tables.length} tables, ${totalRows} rows, sha256 ${sha256.slice(0, 16)}...`,
  );
  console.log(`Wrote ${path.basename(manifestPath)}`);

  let bucketName: string | undefined;
  const uploadedKeys: string[] = [];
  if (flag("no-upload")) {
    console.log(
      "\nSkipped the upload (--no-upload). The archive stays in ./backups.",
    );
  } else {
    const storage = storageFromEnv();
    bucketName =
      option("bucket") ??
      process.env.SUPABASE_BACKUP_BUCKET?.trim() ??
      DEFAULT_BUCKET;
    const state = await ensureBucket(storage, bucketName, MAX_OBJECT_BYTES);
    const prefix = `db/${schema}/${stamp}`;
    const dumpKey = `${prefix}/${path.basename(dumpPath)}`;
    const manifestKey = `${prefix}/${path.basename(manifestPath)}`;

    console.log(`\nBucket ${bucketName} (${state})`);
    await uploadObject(
      storage,
      bucketName,
      dumpKey,
      await readFile(dumpPath),
      "application/octet-stream",
    );
    uploadedKeys.push(dumpKey);
    await uploadObject(
      storage,
      bucketName,
      manifestKey,
      Buffer.from(manifestJson, "utf8"),
      "application/json",
    );
    uploadedKeys.push(manifestKey);
  }

  if (bucketName && uploadedKeys.length > 0) {
    for (const key of uploadedKeys)
      console.log(`  storage://${bucketName}/${key}`);
    if (flag("delete-local")) {
      await rm(dumpPath, { force: true });
      await rm(manifestPath, { force: true });
      console.log("\nRemoved the local copies (--delete-local).");
    } else {
      console.log("\nThe local copies in ./backups are kept (git-ignored).");
    }
    console.log(
      `\nRestore with:\n  npm run db:restore -- --key=${uploadedKeys[0]} --confirm=<target host>`,
    );
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Backup failed.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
