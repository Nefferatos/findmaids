import { existsSync, readFileSync } from "node:fs";

type Env = Record<string, string | undefined>;
export type GuardResult = { ok: true } | { ok: false; reason: string };

const allowedEnvs = new Set(["staging", "test"]);
const forbiddenRefs = new Set(["postgres", "localhost", "supabase", "findmaids"]);
const minRefLength = 6;

export class StagingGuardError extends Error {
  constructor(reason: string) {
    super(`Staging write guard refused to run: ${reason}`);
    this.name = "StagingGuardError";
  }
}

// Only host, user and database path are checked so the password can never satisfy the guard.
function urlContainsRef(value: string | undefined, ref: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    const haystack = [url.hostname, decodeURIComponent(url.username), decodeURIComponent(url.pathname)].join(" ").toLowerCase();
    return haystack.includes(ref.toLowerCase());
  } catch {
    return false;
  }
}

export function checkStagingWriteGuard(env: Env = process.env): GuardResult {
  if (!allowedEnvs.has(env.APP_ENV ?? ""))
    return { ok: false, reason: "APP_ENV must be 'staging' or 'test'." };
  if (env.NODE_ENV === "production")
    return { ok: false, reason: "NODE_ENV=production is never allowed." };
  const ref = env.STAGING_PROJECT_REF?.trim();
  if (!ref) return { ok: false, reason: "STAGING_PROJECT_REF is not set." };
  if (ref.startsWith("PASTE_") || ref.length < minRefLength || forbiddenRefs.has(ref.toLowerCase()))
    return { ok: false, reason: "STAGING_PROJECT_REF is a placeholder or too generic." };
  if (!urlContainsRef(env.DATABASE_URL, ref))
    return { ok: false, reason: "STAGING_PROJECT_REF does not appear in DATABASE_URL." };
  if (!urlContainsRef(env.DIRECT_URL, ref))
    return { ok: false, reason: "STAGING_PROJECT_REF does not appear in DIRECT_URL." };
  return { ok: true };
}

export function assertStagingWriteAllowed(env: Env = process.env) {
  const result = checkStagingWriteGuard(env);
  if (!result.ok) throw new StagingGuardError(result.reason);
}

// Values from the file replace inherited ones so a shell pointing at another database cannot leak in.
export function loadEnvFile(path: string, target: Env = process.env) {
  if (!existsSync(path)) throw new StagingGuardError(`${path} does not exist.`);
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if (/^(".*"|'.*')$/.test(value)) value = value.slice(1, -1);
    target[match[1]] = value;
  }
}
