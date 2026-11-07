import type { NextConfig } from "next";

// React dev mode needs eval(); production keeps the strict policy unchanged.
const devEval = process.env.NODE_ENV === "production" ? "" : "'unsafe-eval' ";

const nextConfig: NextConfig = {
  // Prisma's generated client ships workerd-specific code and loads its query
  // compiler from query_compiler_bg.wasm. Bundling it for Node makes the worker
  // resolve that file through fs at runtime and fail with
  // `no such file or directory, readAll '/bundle/node_modules/.prisma/client/query_compiler_bg.wasm'`.
  // Keeping both packages external lets the Cloudflare build pick the workerd
  // entrypoints. See OpenNext's "Database & ORM" and "workerd specific packages" how-tos.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  // Lets a staging E2E server run beside another dev server (set only by playwright.config.ts).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' ${devEval}https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss:; frame-src https://challenges.cloudflare.com https://www.google.com; upgrade-insecure-requests`,
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
