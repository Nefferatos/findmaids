import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// The CSRF guard in middleware.ts rejects cookie-authenticated mutations that lack a same-origin Origin header.
export const sameOrigin = {
  origin: process.env.PLAYWRIGHT_BASE_URL ?? `http://${process.env.E2E_STAGING === "1" && process.env.E2E_PORT ? "localhost" : "127.0.0.1"}:${process.env.E2E_PORT ?? "3000"}`,
};

// Engine type "client" needs a driver adapter. Driver adapters ignore the
// `schema` query parameter, so the schema is passed explicitly.
export const prisma = new PrismaClient({
  adapter: new PrismaPg(
    { connectionString: process.env.DIRECT_URL, max: 2 },
    { schema: process.env.DATABASE_SCHEMA?.trim() || "findmaids" },
  ),
});
