import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * The display-only dev server (no DATABASE_URL) mirrors the in-memory Prisma
 * mock from `lib/prisma-mock.ts` to this JSON file, so specs can assert on rows
 * and seed records such as e-mail verification tokens.
 */
export const mockDbFile =
  process.env.PRISMA_MOCK_FILE?.trim() || ".next-display/mock-db.json";

type Row = Record<string, unknown>;
export type MockStore = Record<string, Row[]>;

const emptyTables = [
  "user",
  "account",
  "session",
  "emailVerificationToken",
  "agencyOnboardingDraft",
  "rateLimitBucket",
];

export function readStore(): MockStore {
  if (!existsSync(mockDbFile)) return {};
  try {
    return (
      JSON.parse(readFileSync(mockDbFile, "utf8"), (key, value) =>
        typeof value === "string" && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(value)
          ? new Date(value)
          : value,
      ) as { store?: MockStore }
    ).store ?? {};
  } catch {
    return {};
  }
}

export function writeStore(store: MockStore) {
  mkdirSync(dirname(mockDbFile), { recursive: true });
  writeFileSync(mockDbFile, JSON.stringify({ store }, null, 2));
}

/** Clears users, tokens, drafts and rate-limit buckets between runs. */
export function resetStore() {
  writeStore(Object.fromEntries(emptyTables.map((table) => [table, []])));
}

export function rows(model: string): Row[] {
  return readStore()[model] ?? [];
}

export function findUser(email: string): Row | null {
  const normalised = email.toLowerCase();
  return (
    rows("user").find(
      (row) => String(row.email).toLowerCase() === normalised,
    ) ?? null
  );
}

/**
 * Mirrors what `/api/register` does, but with a token the spec knows in
 * plaintext: only the SHA-256 hash is stored by the app.
 */
export function seedVerificationToken(userId: string, ttlMs = 60_000): string {
  const rawToken = randomBytes(24).toString("hex");
  const store = readStore();
  store.emailVerificationToken ??= [];
  store.emailVerificationToken.push({
    id: `token-${rawToken.slice(0, 8)}`,
    userId,
    tokenHash: createHash("sha256").update(rawToken).digest("hex"),
    expiresAt: new Date(Date.now() + ttlMs),
    consumedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  writeStore(store);
  return rawToken;
}
