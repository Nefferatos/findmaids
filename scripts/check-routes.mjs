#!/usr/bin/env node
/**
 * Route and internal-link audit for the App Router.
 *
 * 1. Lists every page route (route groups stripped, dynamic segments kept).
 * 2. Lists every API route handler.
 * 3. Scans app/, components/ and lib/ for internal links (`href`, `action`,
 *    `router.push`, `redirect`) and reports any static target that has no
 *    matching page route.
 *
 * Optional: pass a base URL to HTTP-check each page route, e.g.
 *
 *   node scripts/check-routes.mjs https://findmaids.wow-aisolution.workers.dev
 *
 * Exits non-zero when a link has no destination (or an HTTP check fails), so it
 * can run in CI.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const scanDirs = ["app", "components", "lib"];

async function walk(dir, files = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, files);
    else files.push(full);
  }
  return files;
}

/** `app/(public)/agencies/[slug]/page.tsx` -> `/agencies/[slug]` */
function routeFromPage(file) {
  const rel = path.relative(root, file).split(path.sep).join("/");
  const segments = rel
    .replace(/^app\//, "")
    .replace(/\/?page\.tsx$/, "")
    .split("/")
    // Route groups `(public)` do not appear in the URL.
    .filter((segment) => segment && !/^\(.*\)$/.test(segment));
  return "/" + segments.join("/");
}

function routeFromApi(file) {
  const rel = path.relative(root, file).split(path.sep).join("/");
  const segments = rel
    .replace(/^app\//, "")
    .replace(/\/?route\.ts$/, "")
    .split("/")
    .filter((segment) => segment && !/^\(.*\)$/.test(segment));
  return "/" + segments.join("/");
}

/** `/agencies/[slug]` -> /^\/agencies\/[^/]+$/ */
function routeMatcher(route) {
  const segments = route.split("/").filter(Boolean);
  if (segments.length === 0) return /^\/$/;
  const pattern = segments
    .map((segment) => {
      if (/^\[\[\.\.\..+\]\]$/.test(segment)) return "(?:/.*)?";
      if (/^\[\.\.\..+\]$/.test(segment)) return "/.+";
      if (/^\[.+\]$/.test(segment)) return "/[^/]+";
      return "/" + segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("");
  if (route === "/") return /^\/$/;
  return new RegExp(`^${pattern}\/?$`);
}

const allFiles = (await Promise.all(scanDirs.map((dir) => walk(path.join(root, dir))))).flat();
const pages = allFiles
  .filter((file) => file.endsWith(`${path.sep}page.tsx`))
  .map(routeFromPage)
  .sort();
const apiRoutes = allFiles
  .filter((file) => file.endsWith(`${path.sep}route.ts`))
  .map(routeFromApi)
  .sort();

const matchers = pages.map((route) => ({ route, regex: routeMatcher(route) }));

function destination(link) {
  // Ignore external, protocol-relative, mail, tel and pure anchors.
  if (!link.startsWith("/")) return null;
  if (link.startsWith("//")) return null;
  const withoutQuery = link.split(/[?#]/)[0] || "/";
  return withoutQuery.length > 1 ? withoutQuery.replace(/\/$/, "") : "/";
}

const sourceFiles = allFiles.filter((file) => /\.(tsx?|mjs)$/.test(file) && !/\.test\./.test(file));
const linkPatterns = [
  /\bhref=(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\}|\{"([^"]*)"\})/g,
  /\baction="([^"]*)"/g,
  /\brouter\.push\((?:"([^"]*)"|`([^`]*)`)\)/g,
  /\bredirect\((?:"([^"]*)"|`([^`]*)`)\)/g,
];

const links = new Map();
for (const file of sourceFiles) {
  const source = await readFile(file, "utf8");
  for (const pattern of linkPatterns) {
    for (const match of source.matchAll(pattern)) {
      const raw = (match[1] ?? match[2] ?? match[3] ?? match[4] ?? "").trim();
      // Template literal with interpolation: keep the static prefix so a
      // `/agency/maids/${id}/edit` link is checked against the dynamic route.
      const target = raw.includes("${")
        ? raw.slice(0, raw.indexOf("${")).replace(/\/$/, "")
        : destination(raw);
      if (!target || !target.startsWith("/")) continue;
      const rel = path.relative(root, file).split(path.sep).join("/");
      if (!links.has(target)) links.set(target, { dynamic: raw.includes("${"), sources: new Set() });
      links.get(target).sources.add(rel);
    }
  }
}

const broken = [];
for (const [target, entry] of [...links].sort(([a], [b]) => a.localeCompare(b))) {
  const match = entry.dynamic
    ? pages.some((route) => route.startsWith(`${target}/`) && route.includes("["))
    : matchers.some((candidate) => candidate.regex.test(target));
  if (!match) broken.push({ target, sources: [...entry.sources] });
}

console.log(`Pages: ${pages.length}`);
for (const route of pages) console.log(`  ${route}`);
console.log(`\nAPI routes: ${apiRoutes.length}`);
for (const route of apiRoutes) console.log(`  ${route}`);
console.log(`\nInternal link targets: ${links.size}`);
console.log(`\nUnresolved internal links: ${broken.length}`);
for (const { target, sources } of broken) {
  console.log(`  ${target}  <- ${sources.join(", ")}`);
}

const baseUrl = process.argv[2];
let httpFailures = 0;
if (baseUrl) {
  console.log(`\nHTTP check against ${baseUrl}`);
  for (const route of pages) {
    if (route.includes("[")) {
      console.log(`  SKIP ${route} (dynamic parameter)`);
      continue;
    }
    try {
      const response = await fetch(`${baseUrl}${route}`, { redirect: "manual" });
      const status = response.status;
      const healthy = status < 400 || status === 401 || status === 403;
      if (!healthy) httpFailures += 1;
      console.log(`  ${healthy ? "OK  " : "FAIL"} ${status} ${route}`);
    } catch (error) {
      httpFailures += 1;
      console.log(`  FAIL ERR ${route} ${error instanceof Error ? error.message : error}`);
    }
  }
}

if (broken.length > 0 || httpFailures > 0) process.exitCode = 1;
