/**
 * In-memory Prisma client used for display-only deployments and for local
 * end-to-end runs where no DATABASE_URL is configured.
 *
 * It implements just enough of the Prisma Client surface for the application's
 * read/write paths: findUnique/findFirst/findMany/create/update/upsert/delete,
 * count/aggregate, `$transaction` (array and callback form), plus `$queryRaw`
 * for the rate-limit bucket upsert in `lib/rate-limit.ts`.
 *
 * Rows live in `globalThis` so they survive Next.js module re-evaluation in
 * development. Set `PRISMA_MOCK_FILE` to mirror the store to a JSON file; the
 * file is re-read on every operation, which lets tests (or another process)
 * inspect and seed rows.
 */
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { PrismaClient } from "@prisma/client";

type Row = Record<string, unknown>;
type Store = Record<string, Row[]>;

const STORE_KEY = "__findmaidsPrismaMockStore";
const MOCK_FILE = process.env.PRISMA_MOCK_FILE?.trim() || null;

function emptyStore(): Store {
  return { rateLimitBucket: [] };
}

function readFileStore(): Store | null {
  if (!MOCK_FILE || !existsSync(MOCK_FILE)) return null;
  try {
    const parsed = JSON.parse(readFileSync(MOCK_FILE, "utf8"), revive) as {
      store?: Store;
    };
    return parsed.store ?? null;
  } catch {
    return null;
  }
}

const runtime = globalThis as unknown as Record<string, Store | undefined>;
const memoryStore: Store =
  (runtime[STORE_KEY] ??= readFileStore() ?? emptyStore());

function currentStore(): Store {
  // Re-read the mirrored file so seeded/updated rows from another process land.
  const fileStore = readFileStore();
  if (fileStore) {
    for (const key of Object.keys(fileStore)) memoryStore[key] = fileStore[key];
  }
  return memoryStore;
}

function persist() {
  if (!MOCK_FILE) return;
  try {
    mkdirSync(dirname(MOCK_FILE), { recursive: true });
    writeFileSync(MOCK_FILE, JSON.stringify({ store: memoryStore }, null, 2));
  } catch {
    // Display-only mode must never crash the app because of the mirror file.
  }
}

function table(name: string): Row[] {
  const store = currentStore();
  store[name] ??= [];
  return store[name];
}

function isDate(value: unknown): value is Date {
  return value instanceof Date;
}

/**
 * Prisma returns `Decimal` for money columns and the app calls `.toNumber()` /
 * `.toString()` on them. Seeded rows use `{ "__decimal": "99.50" }` in the mirror
 * file and are revived into a Decimal-like object here.
 */
function decimal(text: string) {
  return {
    __decimal: text,
    toNumber: () => Number(text),
    toString: () => text,
    valueOf: () => Number(text),
    toJSON: () => ({ __decimal: text }),
  };
}

function revive(key: string, value: unknown): unknown {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as { __decimal?: unknown }).__decimal === "string"
  )
    return decimal((value as { __decimal: string }).__decimal);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(value))
    return new Date(value);
  return value;
}

function toTime(value: unknown): number {
  if (isDate(value)) return value.getTime();
  return new Date(String(value)).getTime();
}

function equalValues(left: unknown, right: unknown): boolean {
  if (isDate(left) || isDate(right)) return toTime(left) === toTime(right);
  return (left ?? null) === (right ?? null);
}

function compareValues(left: unknown, right: unknown): number {
  if (isDate(left) || isDate(right)) return toTime(left) - toTime(right);
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left ?? "").localeCompare(String(right ?? ""));
}

const filterOperators = new Set([
  "equals",
  "not",
  "in",
  "notIn",
  "contains",
  "startsWith",
  "endsWith",
  "lt",
  "lte",
  "gt",
  "gte",
  "mode",
  "is",
  "isNot",
  "has",
  "hasEvery",
  "hasSome",
  "isEmpty",
]);

function matches(row: Row, where: Row | undefined): boolean {
  if (!where) return true;
  for (const [key, condition] of Object.entries(where)) {
    if (condition === undefined) continue;
    if (key === "AND") {
      const clauses = (Array.isArray(condition) ? condition : [condition]) as Row[];
      if (!clauses.every((clause) => matches(row, clause))) return false;
      continue;
    }
    if (key === "OR") {
      const clauses = (Array.isArray(condition) ? condition : [condition]) as Row[];
      if (clauses.length && !clauses.some((clause) => matches(row, clause)))
        return false;
      continue;
    }
    if (key === "NOT") {
      const clauses = (Array.isArray(condition) ? condition : [condition]) as Row[];
      if (clauses.some((clause) => matches(row, clause))) return false;
      continue;
    }
    const value = row[key];
    if (condition === null || typeof condition !== "object" || isDate(condition)) {
      if (!equalValues(value, condition)) return false;
      continue;
    }
    const operators = condition as Row;
    const isOperatorObject = Object.keys(operators).every((operator) =>
      filterOperators.has(operator),
    );
    if (!isOperatorObject) {
      // Relation filter, e.g. { agency: { ownerId } }.
      if (!value || typeof value !== "object" || Array.isArray(value)) return false;
      if (!matches(value as Row, operators)) return false;
      continue;
    }
    if ("equals" in operators && !equalValues(value, operators.equals)) return false;
    if ("not" in operators && equalValues(value, operators.not)) return false;
    if ("is" in operators && !equalValues(value, operators.is)) return false;
    if ("isNot" in operators && equalValues(value, operators.isNot)) return false;
    if ("in" in operators) {
      const candidates = (operators.in as unknown[]) ?? [];
      if (!candidates.some((candidate) => equalValues(value, candidate)))
        return false;
    }
    if ("notIn" in operators) {
      const candidates = (operators.notIn as unknown[]) ?? [];
      if (candidates.some((candidate) => equalValues(value, candidate)))
        return false;
    }
    if ("contains" in operators) {
      const haystack = String(value ?? "").toLowerCase();
      if (!haystack.includes(String(operators.contains).toLowerCase())) return false;
    }
    if ("startsWith" in operators) {
      if (!String(value ?? "").startsWith(String(operators.startsWith)))
        return false;
    }
    if ("endsWith" in operators) {
      if (!String(value ?? "").endsWith(String(operators.endsWith))) return false;
    }
    if ("lt" in operators && compareValues(value, operators.lt) >= 0) return false;
    if ("lte" in operators && compareValues(value, operators.lte) > 0) return false;
    if ("gt" in operators && compareValues(value, operators.gt) <= 0) return false;
    if ("gte" in operators && compareValues(value, operators.gte) < 0) return false;
    if ("has" in operators) {
      if (!Array.isArray(value) || !value.some((item) => equalValues(item, operators.has)))
        return false;
    }
    if ("hasEvery" in operators) {
      const wanted = (operators.hasEvery as unknown[]) ?? [];
      if (!Array.isArray(value)) return false;
      if (!wanted.every((item) => value.some((entry) => equalValues(entry, item))))
        return false;
    }
    if ("hasSome" in operators) {
      const wanted = (operators.hasSome as unknown[]) ?? [];
      if (!Array.isArray(value)) return false;
      if (!wanted.some((item) => value.some((entry) => equalValues(entry, item))))
        return false;
    }
    if ("isEmpty" in operators) {
      if (operators.isEmpty && Array.isArray(value) && value.length > 0) return false;
    }
  }
  return true;
}

function applyOrder(rows: Row[], orderBy: unknown): Row[] {
  const clauses = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
  if (!clauses.length) return rows;
  return [...rows].sort((left, right) => {
    for (const clause of clauses as Row[]) {
      for (const [field, direction] of Object.entries(clause)) {
        const sorted = compareValues(left[field], right[field]);
        if (sorted !== 0)
          return String(direction).toLowerCase() === "desc" ? -sorted : sorted;
      }
    }
    return 0;
  });
}

function project(row: Row | null, args: Row | undefined): Row | null {
  if (!row) return row;
  const select = args?.select as Row | undefined;
  if (select) {
    const picked: Row = {};
    for (const [key, included] of Object.entries(select)) {
      if (included) picked[key] = row[key] ?? null;
    }
    return picked;
  }
  const include = args?.include as Row | undefined;
  if (include) {
    const withRelations: Row = { ...row };
    for (const key of Object.keys(include)) {
      if (!(key in withRelations)) withRelations[key] = null;
    }
    return withRelations;
  }
  return { ...row };
}

function projectMany(rows: Row[], args: Row | undefined): Row[] {
  return rows.map((row) => project(row, args) as Row);
}

/**
 * Column defaults the app relies on (Prisma would apply these from schema.prisma).
 * Without them `token.disabled` in `auth.ts` would be `undefined ?? true`.
 */
const modelDefaults: Record<string, Row> = {
  user: {
    role: "VISITOR",
    disabled: false,
    emailVerified: null,
    image: null,
    totpEnabled: false,
    totpSecret: null,
    totpVerifiedAt: null,
    passwordChangedAt: null,
  },
};

function withDefaults(model: string, data: Row): Row {
  const now = new Date();
  return {
    ...(modelDefaults[model] ?? {}),
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    ...data,
  };
}

function delegate(model: string) {
  const rows = () => table(model);
  const find =
    (many: boolean) =>
    (args: Row = {}) => {
      const matched = applyOrder(
        rows().filter((row) => matches(row, args.where as Row | undefined)),
        args.orderBy,
      );
      if (!many) return project(matched[0] ?? null, args);
      const skip = typeof args.skip === "number" ? args.skip : 0;
      const take = typeof args.take === "number" ? args.take : undefined;
      const page = matched.slice(
        skip,
        take === undefined ? undefined : skip + take,
      );
      return projectMany(page, args);
    };

  const requireRow = (where: Row | undefined, action: string): Row => {
    const row = rows().find((candidate) => matches(candidate, where));
    if (!row) throw new Error(`Prisma mock: ${model}.${action} found no record.`);
    return row;
  };

  const api = {
    findUnique: find(false),
    findUniqueOrThrow: (args: Row = {}) => {
      const row = find(false)(args) as Row | null;
      return row ?? requireRow(args.where as Row | undefined, "findUniqueOrThrow");
    },
    findFirst: find(false),
    findFirstOrThrow: (args: Row = {}) => {
      const row = find(false)(args) as Row | null;
      return row ?? requireRow(args.where as Row | undefined, "findFirstOrThrow");
    },
    findMany: find(true),
    create: (args: Row = {}) => {
      const row = withDefaults(model, (args.data ?? {}) as Row);
      rows().push(row);
      persist();
      return project(row, args);
    },
    createMany: (args: Row = {}) => {
      const created = ((args.data ?? []) as Row[]).map((entry) =>
        withDefaults(model, entry),
      );
      rows().push(...created);
      persist();
      return { count: created.length };
    },
    update: (args: Row = {}) => {
      const row = requireRow(args.where as Row | undefined, "update");
      Object.assign(row, args.data as Row, { updatedAt: new Date() });
      persist();
      return project(row, args);
    },
    updateMany: (args: Row = {}) => {
      const matched = rows().filter((row) =>
        matches(row, args.where as Row | undefined),
      );
      for (const row of matched)
        Object.assign(row, args.data as Row, { updatedAt: new Date() });
      persist();
      return { count: matched.length };
    },
    upsert: (args: Row = {}) => {
      const existing = rows().find((row) =>
        matches(row, args.where as Row | undefined),
      );
      if (existing) {
        Object.assign(existing, args.update as Row, { updatedAt: new Date() });
        persist();
        return project(existing, args);
      }
      const row = withDefaults(model, {
        ...(args.where as Row),
        ...(args.create as Row),
      });
      rows().push(row);
      persist();
      return project(row, args);
    },
    delete: (args: Row = {}) => {
      const row = requireRow(args.where as Row | undefined, "delete");
      const index = rows().indexOf(row);
      if (index >= 0) rows().splice(index, 1);
      persist();
      return project(row, args);
    },
    deleteMany: (args: Row = {}) => {
      const store = rows();
      const keep = store.filter((row) => !matches(row, args.where as Row | undefined));
      const removed = store.length - keep.length;
      store.length = 0;
      store.push(...keep);
      persist();
      return { count: removed };
    },
    count: (args: Row = {}) =>
      rows().filter((row) => matches(row, args.where as Row | undefined)).length,
    aggregate: (args: Row = {}) => ({
      _count: rows().filter((row) => matches(row, args.where as Row | undefined))
        .length,
      _sum: {},
      _avg: {},
      _min: {},
      _max: {},
    }),
    groupBy: (args: Row = {}) =>
      rows().filter((row) => matches(row, args.where as Row | undefined)),
  };
  // Prisma delegate methods always return promises; some call sites rely on it
  // (for example `adminSettings.findUnique(...).catch(() => null)`).
  return Object.fromEntries(
    Object.entries(api).map(([name, method]) => [
      name,
      async (...args: Row[]) => (method as (args?: Row) => unknown)(...args),
    ]),
  );
}

const delegates = new Map<string, unknown>();

function modelDelegate(model: string) {
  if (!delegates.has(model)) delegates.set(model, delegate(model));
  return delegates.get(model)!;
}

async function queryRaw(strings: TemplateStringsArray, ...values: unknown[]) {
  const sql = strings.join("");
  // `lib/payments/invoices.ts` reserves the next invoice number with a counter upsert.
  if (sql.includes("InvoiceSequence")) {
    const year = Number(values[0]);
    const sequence = table("invoiceSequence");
    const existing = sequence.find((row) => Number(row.year) === year);
    const now = new Date();
    if (!existing) {
      sequence.push({ year, lastValue: 1, createdAt: now, updatedAt: now });
      persist();
      return [{ lastValue: 1 }];
    }
    existing.lastValue = Number(existing.lastValue) + 1;
    existing.updatedAt = now;
    persist();
    return [{ lastValue: existing.lastValue }];
  }
  // `lib/rate-limit.ts` is the other raw query: an upsert into RateLimitBucket.
  if (!sql.includes("RateLimitBucket")) return [];
  const key = String(values[0] ?? "unknown");
  const windowEnd = isDate(values[1])
    ? (values[1] as Date)
    : new Date(Date.now() + 3_600_000);
  const now = isDate(values[5]) ? (values[5] as Date) : new Date();
  const buckets = table("rateLimitBucket");
  const existing = buckets.find((row) => row.key === key);
  if (!existing) {
    buckets.push({
      key,
      count: 1,
      expiresAt: windowEnd,
      createdAt: now,
      updatedAt: now,
    });
    persist();
    return [{ count: 1 }];
  }
  const expired = isDate(existing.expiresAt) && (existing.expiresAt as Date) <= now;
  existing.count = expired ? 1 : (existing.count as number) + 1;
  if (expired) existing.expiresAt = windowEnd;
  existing.updatedAt = now;
  persist();
  return [{ count: existing.count }];
}

// Hoisted helper: `$transaction(async (tx) => ...)` needs the proxy, not the
// raw target, so that `tx.model` resolves.
function transactionClient() {
  return mockPrismaClient;
}

const client = {
  $transaction: async (input: unknown) =>
    typeof input === "function"
      ? (input as (tx: unknown) => unknown)(transactionClient())
      : Promise.all(input as Promise<unknown>[]),
  $queryRaw: queryRaw,
  $queryRawUnsafe: async () => [],
  $executeRaw: async () => 0,
  $executeRawUnsafe: async () => 0,
  $connect: async () => undefined,
  $disconnect: async () => undefined,
  $on: () => undefined,
  $extends: () => client,
};

const mockPrismaClient = new Proxy(client, {
  get(target, property, receiver) {
    if (typeof property !== "string")
      return Reflect.get(target, property, receiver);
    if (property in target) return Reflect.get(target, property, receiver);
    if (property.startsWith("$")) return async () => [];
    return modelDelegate(property);
  },
}) as unknown as PrismaClient;

// `$transaction(async (tx) => ...)` must receive the proxy so `tx.model` resolves.
export default mockPrismaClient;
