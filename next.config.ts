import type { NextConfig } from "next";

// React dev mode needs eval(); production keeps the strict policy unchanged.
const devEval = process.env.NODE_ENV === "production" ? "" : "'unsafe-eval' ";

/**
 * Packages that are only needed to build, test or deploy the app.
 *
 * Prisma's generated workerd client imports `query_engine_bg.wasm?module`, and
 * Turbopack resolves that module through a dynamic `node`/`path` helper whose
 * pattern matches every file in the project. Next's output tracer therefore
 * copied the *entire* `node_modules` tree (eslint, vitest, playwright, webpack,
 * the Prisma CLI, the Cloudflare toolchain, …) into the OpenNext server bundle.
 * That made `wrangler deploy` fail while bundling/uploading the Worker (the
 * deploy step stops right after OpenNext reports "Incremental cache does not
 * need populating"), which is why the live site kept serving an older build.
 *
 * None of these packages are imported by server code at runtime, so excluding
 * them from the trace keeps the Worker bundle to the app's real dependencies.
 * `scripts/prune-worker-bundle.mjs` applies the same list to an already built
 * bundle as a safety net.
 */
const BUILD_ONLY_TREES = [
  "./node_modules/.cache/**",
  "./.next/cache/**",
  "./.next/dev/**",
  "./node_modules/typescript/**",
  "./node_modules/tsx/**",
  "./node_modules/eslint/**",
  "./node_modules/eslint-config-next/**",
  "./node_modules/@eslint/**",
  "./node_modules/@typescript-eslint/**",
  "./node_modules/typescript-eslint/**",
  "./node_modules/prettier/**",
  "./node_modules/prettier-plugin-tailwindcss/**",
  "./node_modules/vitest/**",
  "./node_modules/@vitest/**",
  "./node_modules/vite/**",
  "./node_modules/@vitejs/**",
  "./node_modules/playwright/**",
  "./node_modules/playwright-core/**",
  "./node_modules/@playwright/**",
  "./node_modules/webpack/**",
  "./node_modules/webpack-sources/**",
  "./node_modules/terser/**",
  "./node_modules/tailwindcss/**",
  "./node_modules/@tailwindcss/**",
  "./node_modules/postcss/**",
  "./node_modules/autoprefixer/**",
  "./node_modules/prisma/**",
  "./node_modules/@prisma/engines/**",
  "./node_modules/@prisma/studio*/**",
  "./node_modules/wrangler/**",
  "./node_modules/miniflare/**",
  "./node_modules/workerd/**",
  "./node_modules/@cloudflare/**",
  "./node_modules/esbuild/**",
  "./node_modules/@esbuild/**",
  "./node_modules/rollup/**",
  "./node_modules/@rollup/**",
  "./node_modules/@babel/**",
  "./node_modules/@swc/**",
  "./node_modules/@ast-grep/**",
  "./node_modules/@node-minify/**",
  "./node_modules/@napi-rs/**",
  "./node_modules/@webassemblyjs/**",
  "./node_modules/@xtuc/**",
  "./node_modules/@types/**",
  "./node_modules/@tsconfig/**",
  "./node_modules/@sentry/cli/**",
  "./node_modules/@sentry/webpack-plugin/**",
  "./node_modules/@sentry/rollup-plugin/**",
  "./node_modules/@sentry/vite-plugin/**",
  // Rendered in the browser only (charts, icons, toasts); their client chunks
  // are already in `.next/static`, so the server trace does not need them.
  "./node_modules/recharts/**",
  "./node_modules/victory-vendor/**",
  "./node_modules/d3-*/**",
  "./node_modules/lucide-react/**",
  "./node_modules/sonner/**",
  "./node_modules/@marsidev/**",
];

const nextConfig: NextConfig = {
  // Prisma Client is now generated into `lib/generated/prisma` (see
  // prisma/schema.prisma) with `runtime = "workerd"`, so it is compiled as part
  // of the app and imports its engine as a `.wasm?module` module — that is what
  // the Cloudflare build needs. `pdfjs-dist` stays external because it loads
  // `pdf.worker.mjs` by relative path at runtime.
  serverExternalPackages: ["pdfjs-dist"],
  outputFileTracingExcludes: {
    // "*" matches every route (page and route handler).
    "*": BUILD_ONLY_TREES,
  },
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
