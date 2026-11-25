import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".open-next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Wrangler writes temporary bundles next to the project on every deploy;
    // linting them reported errors from generated middleware facades.
    ".wrangler/**",
    // Vendored/minified third-party worker (pdf.js) and generated Prisma client.
    "public/pdf.worker.min.mjs",
    "lib/generated/**",
    "coverage/**",
  ]),
]);

export default eslintConfig;
