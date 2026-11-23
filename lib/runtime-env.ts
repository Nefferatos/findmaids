/**
 * Runtime environment access for code that is also bundled for the edge /
 * middleware runtime.
 *
 * Next.js compiles literal `process.env.<NAME>` reads in the middleware bundle
 * at build time with the value from the build machine. This app deliberately
 * builds without `.env` (the deploy script parks it; runtime configuration comes
 * from `wrangler.jsonc` vars and `wrangler secret`), so those reads were
 * inlined as `undefined` — the deployed middleware saw no `NEXTAUTH_URL`, looked
 * for an unprefixed `authjs.session-token` cookie while Auth.js had issued
 * `__Secure-authjs.session-token`, and treated every signed-in request as
 * anonymous (bouncing users back to /login).
 *
 * Reading through `globalThis.process` with a computed key is not statically
 * analysable, so the lookup survives bundling and resolves against the
 * environment OpenNext populates from the Worker at runtime.
 */
export function runtimeEnv(name: string): string | undefined {
  const env = (
    globalThis as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env;
  const value = env?.[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Session/JWT signing secret, resolved at runtime. */
export function runtimeAuthSecret(): string | undefined {
  return runtimeEnv("AUTH_SECRET") ?? runtimeEnv("NEXTAUTH_SECRET");
}
