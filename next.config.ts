import type { NextConfig } from "next";

// React dev mode needs eval(); production keeps the strict policy unchanged.
const devEval = process.env.NODE_ENV === "production" ? "" : "'unsafe-eval' ";

const nextConfig: NextConfig = {
  // Prisma Client is now generated into `lib/generated/prisma` (see
  // prisma/schema.prisma) with `runtime = "workerd"`, so it is compiled as part
  // of the app and imports its engine as a `.wasm?module` module — that is what
  // the Cloudflare build needs. `pdfjs-dist` stays external because it loads
  // `pdf.worker.mjs` by relative path at runtime.
  serverExternalPackages: ["pdfjs-dist"],
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
            value: `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' ${devEval}https://challenges.cloudflare.com https://cdn.jsdelivr.net 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https: wss:; frame-src https://challenges.cloudflare.com https://www.google.com; upgrade-insecure-requests`,
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
