# Deploying FindMaids to Cloudflare Workers

FindMaids uses Next.js App Router with OpenNext's Cloudflare adapter. The frontend and Next.js API routes run in the same Worker. PostgreSQL is hosted separately on Supabase.

## Cloudflare configuration

The Worker is configured in `wrangler.jsonc`, and `open-next.config.ts` selects the OpenNext Cloudflare adapter. The deployment scripts are:

```sh
npm run preview:cf
npm run deploy:cf
```

OpenNext currently warns that its build is not fully supported on Windows and may fail while creating symlinks. Build from WSL/Linux or Cloudflare Workers Builds. Node.js 20.19 or newer is required by this repository.

## Deploying from Windows without Administrator rights

`npm run deploy:cf` cannot complete on Windows unless the shell is elevated or Developer Mode is enabled, because OpenNext creates symlinks while bundling. For a non-elevated Windows machine use:

```powershell
npm run deploy:cf:win
```

`scripts/deploy-cloudflare-windows.ps1` runs the same build and upload, and works around the two Windows-specific obstacles:

1. It installs a Node preload shim (`%TEMP%\findmaids-symlink-shim.cjs`) that replaces `fs.symlink*` calls with junctions/hardlinks, which need no privilege. Relative link targets are resolved against the link's directory — resolving them against the process working directory silently produces `C:\node_modules\...` links and a confusing `ENOENT ... copyfile` failure.
2. Next crops the optional `pg-cloudflare` package to `dist/empty.js` in `.next/standalone` while its `package.json` still points at `dist/index.js`, so esbuild fails to resolve it. The script restores the package from `node_modules` and re-runs the bundling step with `--skipNextBuild`.

Useful switches: `-SkipNextBuild` (re-bundle and redeploy an existing `.next`), `-SkipDeploy` (build only), `-ResetDevCache` (delete `.next` so `next dev` starts clean — the production build leaves Turbopack state that breaks `npm run dev` with a postcss loader crash).

CI (`deploy.yml`) remains the recommended path; it builds on a Linux runner and needs no workarounds.

## Never build with the local `.env` in place

OpenNext bakes the build-time environment into the Worker: it writes
`.open-next/cloudflare/next-env.mjs` from the `.env` file and copies `.env` into
`.open-next/server-functions/default/.env`. Building a production bundle on a
machine that has a filled-in `.env` therefore

- uploads development secrets (database password, auth secrets) inside the
  Worker, and
- points the deployed app at the local database (`127.0.0.1:5433`), so every
  page that touches the database fails — Prisma reports
  `no such file or directory, readAll '/bundle/node_modules/.prisma/client/query_compiler_bg.wasm'`
  or a connection error, and `app/error.tsx` renders "Service interruption".

`scripts/deploy-cloudflare-windows.ps1` parks `.env` for the build and refuses to
deploy if `next-env.mjs` still contains local values. Deployment configuration
must come from `wrangler.jsonc` `vars` plus `wrangler secret put NAME`.

Prisma also needs to stay external so the build resolves its workerd entrypoints
(`next.config.ts`):

```ts
serverExternalPackages: ["@prisma/client", ".prisma/client"],
```

Without that, the query compiler WASM is looked up through `fs` at runtime and
the first database call throws.

## Before deploying

1. In Cloudflare, create a Hyperdrive configuration connected to the Supabase PostgreSQL database. Add its returned ID to a `hyperdrive` binding named `HYPERDRIVE` in `wrangler.jsonc`. Use the Supabase staging project for a staging deployment and production only when ready.
2. Add the application's runtime secrets as Worker secrets in the Cloudflare dashboard or with `wrangler secret put`. At minimum, configure `DATABASE_URL` with the matching Supabase PostgreSQL connection string, `AUTH_SECRET`, and `TOTP_ENCRYPTION_KEY`. Add provider-specific secrets for the features you enable. Do not commit `.env` files or paste secret values into chat.
3. Configure the required public/runtime variables, including `NEXT_PUBLIC_SITE_URL`, `NEXTAUTH_URL`, `SUPABASE_URL`, and `SUPABASE_MEDIA_BUCKET` / `SUPABASE_PRIVATE_BUCKET`.
4. Apply the Prisma migrations to the matching database and configure the Supabase Storage buckets and access policies.
5. Run `npm run preview:cf` from WSL/Linux and verify the app and `/api/health`; then deploy with `npm run deploy:cf`.

The local `.env` files are for development and are not uploaded with a Worker. Never place database passwords, signing keys, service role keys, or provider API keys in `wrangler.jsonc` or `[vars]`.

Prisma uses the `pg` adapter and reads `HYPERDRIVE.connectionString` in the Worker runtime. Local Node.js continues to use `DATABASE_URL`.
