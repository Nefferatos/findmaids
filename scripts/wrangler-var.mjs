#!/usr/bin/env node
/**
 * Reads a value from a wrangler `.jsonc` config without a JSONC parser.
 *
 * Prettier writes trailing commas into `.jsonc` files and `JSON.parse` rejects
 * them, which silently dropped `NEXT_PUBLIC_SITE_URL` from the build. This
 * helper strips comments and trailing commas, validates the JSON, and prints the
 * requested dotted value.
 *
 *   node scripts/wrangler-var.mjs wrangler.jsonc vars.NEXT_PUBLIC_SITE_URL
 */
import { readFileSync } from "node:fs";

const [file, keyPath = "vars.NEXT_PUBLIC_SITE_URL"] = process.argv.slice(2);
if (!file) {
  console.error(
    "usage: node scripts/wrangler-var.mjs <config.jsonc> [vars.KEY]",
  );
  process.exit(2);
}

const raw = readFileSync(file, "utf8");
const json = raw
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split(/\r?\n/)
  .filter((line) => !/^\s*\/\//.test(line))
  .join("\n")
  .replace(/,\s*([}\]])/g, "$1");

let parsed;
try {
  parsed = JSON.parse(json);
} catch (error) {
  console.error(
    `[wrangler-var] ${file} is not valid JSON/JSONC: ${error.message}`,
  );
  process.exit(1);
}

const value = keyPath
  .split(".")
  .reduce((acc, key) => (acc == null ? acc : acc[key]), parsed);
process.stdout.write(typeof value === "string" ? value : "");
