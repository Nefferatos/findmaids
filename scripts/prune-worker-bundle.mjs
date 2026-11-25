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

// Directories that are only used to build/test/deploy the app. This mirrors
// `BUILD_ONLY_TREES` in next.config.ts: Turbopack's wasm loader makes Next trace
// the whole project, so these would otherwise land in the Worker bundle and make
// `wrangler deploy` fail.
const BUILD_ONLY = [
  "wrangler",
  "miniflare",
  "workerd",
  "@cloudflare",
  "typescript",
  "tsx",
  "eslint",
  "eslint-config-next",
  "@eslint",
  "@typescript-eslint",
  "typescript-eslint",
  "prettier",
  "prettier-plugin-tailwindcss",
  "vitest",
  "@vitest",
  "vite",
  "@vitejs",
  "playwright",
  "playwright-core",
  "@playwright",
  "webpack",
  "webpack-sources",
  "terser",
  "tailwindcss",
  "@tailwindcss",
  "postcss",
  "autoprefixer",
  "prisma",
  "@prisma/engines",
  "esbuild",
  "@esbuild",
  "rollup",
  "@rollup",
  "@babel",
  "@swc",
  "@ast-grep",
  "@node-minify",
  "@napi-rs",
  "@webassemblyjs",
  "@xtuc",
  "@types",
  "@tsconfig",
  "@sentry/cli",
  "@sentry/webpack-plugin",
  "@sentry/rollup-plugin",
  "@sentry/vite-plugin",
  // Browser-only UI packages (client chunks live in .next/static).
  "recharts",
  "victory-vendor",
  "lucide-react",
  "sonner",
  "@marsidev",
  // npm's build cache lives inside node_modules.
  ".cache",
];

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

// Next's runtime helper `@next/env` is needed; the platform SWC binary and the
// ESLint plugin are not. Handled separately because the SWC package name is
// platform-specific (`@next/swc-linux-x64-gnu` on CI, `-win32-x64-msvc` locally).
const nextScope = join(bundleModules, "@next");
if (existsSync(nextScope)) {
  for (const entry of readdirSync(nextScope)) {
    if (entry !== "env") remove(join(nextScope, entry));
  }
}

// Next's build/dev caches are not needed by the deployed Worker.
const bundleNext = join(root, ".open-next", "server-functions", "default", ".next");
for (const name of ["cache", "dev"]) remove(join(bundleNext, name));

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
