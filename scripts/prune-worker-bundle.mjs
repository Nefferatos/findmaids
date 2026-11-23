#!/usr/bin/env node
/**
 * Trims the OpenNext server bundle before `wrangler deploy`.
 *
 * Cloudflare rejects Worker scripts over 63.9 MiB uncompressed (code 10027), and
 * the bundle picks up a lot of build-only weight from `node_modules`:
 *
 *   - Prisma's native query engines (`query_engine-<platform>.node`, ~20 MB each)
 *     which can never load in workerd — the deployed client uses the bundled
 *     `query_engine_bg.wasm` instead.
 *   - Wrangler/Miniflare/workerd, which are only needed to build and deploy.
 *
 * `prisma` itself stays: its `build/*_bg.wasm` files are referenced by the
 * bundle. The generated client (`lib/generated/prisma`) is untouched.
 *
 * Usage: node scripts/prune-worker-bundle.mjs [--dry-run]
 */
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundleModules = join(root, ".open-next", "server-functions", "default", "node_modules");

// Directories that are only used to build/deploy the Worker.
const BUILD_ONLY = ["wrangler", "miniflare", "workerd", "@cloudflare"];

// Package directories whose native `.node` binaries must never be uploaded.
const NATIVE_ENGINES = [join("prisma"), join("@prisma", "engines")];

const dryRun = process.argv.includes("--dry-run");

if (!existsSync(bundleModules)) {
  console.error(`[prune] no bundle at ${bundleModules} — run the OpenNext build first`);
  process.exit(1);
}

let removed = 0;

function remove(target) {
  if (!existsSync(target)) return;
  const size = statSync(target).isDirectory() ? null : statSync(target).size;
  if (dryRun) {
    console.log(`[prune] would remove ${target}`);
  } else {
    rmSync(target, { recursive: true, force: true });
    console.log(`[prune] removed ${target.replace(`${root}\\`, "").replace(`${root}/`, "")}`);
  }
  removed += size ?? 0;
}

for (const name of BUILD_ONLY) remove(join(bundleModules, name));

// Native engine binaries are large and useless on workerd.
for (const name of NATIVE_ENGINES) {
  const dir = join(bundleModules, name);
  if (!existsSync(dir)) continue;
  for (const entry of listFiles(dir)) {
    if (entry.endsWith(".node")) remove(entry);
  }
}

function* listFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* listFiles(full);
    else yield full;
  }
}

console.log(`[prune] done (${(removed / 1024 / 1024).toFixed(1)} MB of files removed)`);
