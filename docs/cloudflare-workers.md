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

## Prisma on the Workers runtime

The generated Prisma Client is compiled into the Worker, so it has to load its
query engine as a WebAssembly module instead of reading a binary from disk. That
is why `prisma/schema.prisma` uses the `prisma-client` generator with
`runtime = "workerd"` and writes to `lib/generated/prisma`:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../lib/generated/prisma"
  runtime  = "workerd"
}
```

The generator emits `import("./query_engine_bg.wasm?module")`, which is the form
OpenNext/Cloudflare can turn into a `CompiledWasm` module (the `rules` entry in
`wrangler.jsonc`). `lib/generated/` is git-ignored and regenerated by
`npm run db:generate` — `prebuild` runs it automatically, and the GitHub Actions
workflow does too.

The older `prisma-client-js` + `engineType = "client"` setup does **not** work
here: OpenNext resolves that package's Node entrypoint, so the Worker tries
`fs.readFile('/bundle/node_modules/.prisma/client/query_compiler_bg.wasm')` and
fails with `no such file or directory, readAll` (visible in `wrangler tail`, and
`/api/health` reports `{"database":"error"}`).

Do not add `@prisma/client` / `.prisma/client` back to `serverExternalPackages`
in `next.config.ts` — bundling is what lets the wasm reach the Worker.

### The Free plan is not enough

Cloudflare's Free plan allows **10 ms of CPU per request**. This app needs far
more, and the failures look like unrelated bugs:

- `/api/health` (one `$queryRaw`) costs ~40 ms CPU but usually passes.
- `/api/auth/providers` costs ~10 ms and was killed with
  `outcome: "exceededCpu"` (HTTP 503).
- `/api/auth/callback/credentials` runs a rate-limit query, a user lookup, a
  `bcrypt` comparison and a second query in the `jwt` callback, so it exceeds the
  budget and the browser reports `500` on
  `POST /api/auth/callback/credentials` (the response is an HTML error page, which
  is why `login` then logs `Unexpected token '<' ... is not valid JSON`).

Symptoms are intermittent because the limit is enforced against a moving average.
`wrangler tail --format json` is the way to confirm it: look for
`"outcome": "exceededCpu"` and the `cpuTime` field.

The only real fix is a paid plan (Workers Paid, $5/month), which raises the limit
to 30 s per invocation. After upgrading, uncomment the `limits` block in
`wrangler.jsonc`:

```jsonc
"limits": { "cpu_ms": 30000 }
```

Deploying that block while still on Free fails with
`CPU limits are not supported for the Free plan ... [code: 100328]`.

### Connection handling
`lib/prisma.ts` passes `maxUses: 1` to `PrismaPg`. Workers cannot keep a socket
open between requests: Hyperdrive closes it when the response finishes, so a
reused pooled connection hangs until the runtime cancels the request
(`The Workers runtime canceled this request because it detected that your
Worker's code had hung`). A single `/api/health` query may still succeed while
multi-query pages hang, which is how that failure shows up.

### Worker size

Cloudflare rejects scripts above 63.9 MiB uncompressed (`code: 10027`).
`scripts/prune-worker-bundle.mjs` keeps the upload under that by removing what
the Worker can never load from
`.open-next/server-functions/default/node_modules`: Prisma's native
`query_engine-*.node` binaries (~20 MB each) and the `wrangler` / `miniflare` /
`workerd` build tooling (the last full run removed 40.4 MB). Both
`npm run deploy:cf` and the Windows script run it after the OpenNext build and
before `wrangler deploy`.

`wrangler.jsonc` also sets `"minify": true` and `"upload_source_maps": false`.
Note that OpenNext uploads the worker it already bundled, so the source map is
never generated and `minify` does not shrink that file — the prune step is what
actually keeps the script inside the limit.

Pruning removes files, so never re-run `wrangler deploy` on a pruned tree without
rebuilding if a package needs restoring (`prisma` and `tesseract.js-core` are
referenced by the bundle and must stay).

### Build memory

`next build` compiles the generated client and needs more heap than Node's
default on Windows. Export `NODE_OPTIONS=--max-old-space-size=6144` before
building; the first compile takes ~7 minutes.

## Caching

**ISR is deliberately disabled.** The public homepage, `/agencies`,
`/agencies/[slug]` and `/advertise` all read the database, and a cached page can
show an approval, suspension, profile edit, maid change or published review up to
five minutes late. Each of those pages therefore declares:

```ts
export const dynamic = "force-dynamic";
```

They render per request. Because `open-next.config.ts` passes
`defineCloudflareConfig({})` (no incremental cache), ISR would have no durable
store on Workers anyway — it would only have looked cached.

Consequences to keep in mind:

- Every public page view costs one or more database queries. If that becomes a
  bottleneck, re-introduce caching deliberately: add `revalidate`, an R2
  incremental cache plus `NEXT_INC_CACHE_R2_BUCKET` binding, and purge the
  affected paths from every mutation that changes them.
- Do not put HTML in Cloudflare's cache without a purge strategy; a Worker
  response is not cached by default.
- Authenticated endpoints must never be shared-cached. `GET /api/agency/maids`
  sends `Cache-Control: private, no-store`, and the existing admin/agency exports
  do the same. Pages that read cookies/session are dynamic by nature.
- Client-side navigation still uses the Next.js router cache; the dashboard
  forms call `router.refresh()` after a successful mutation.

**Storage caching.** Supabase Storage serves objects with
`cache-control: private, no-cache` plus an `ETag`; upload-time `cache-control`
headers, query parameters and multipart fields are ignored (verified against the
project). Browsers revalidate each image (cheap 304s) and deletions take effect
immediately.

## Biodata PDF import, OCR, and form autofill

The Add Maid importer parses PDF/DOCX text and embedded photos on the server, and runs OCR **in the visitor's browser** for scanned or sparse PDFs:

- `pdfjs-dist` renders pages to a canvas using the same-origin worker at `public/pdf.worker.min.mjs` (refresh it with `npm run sync:pdf-worker` after upgrading pdfjs).
- `tesseract.js` (WebAssembly) reads the rendered pages. Its worker, WASM core and English language data are fetched from jsDelivr and cached by the browser.
- The recognized text is posted to `POST /api/agency/maids/import/ocr`, parsed with the same deterministic label/field parser as text PDFs, and applied to the form automatically for review.
- The portrait is detected on the rendered page, cropped, and uploaded through the normal media endpoint. For scanned documents the server does not attach the page image as the maid photo.

Why client-side: Workers cannot run native OCR or a canvas (`sharp`/`@napi-rs/canvas` are not deployable), and multi-page OCR would exceed practical serverless request limits. Running pdf.js + Tesseract in the browser works on the current Cloudflare deployment without new bindings, secrets or native binaries.

Required CSP allowances (`next.config.ts`): `script-src` includes `https://cdn.jsdelivr.net` and `'wasm-unsafe-eval'`; `worker-src 'self' blob:`; `connect-src` already allows HTTPS for the CDN and language data.

Limits and privacy: 8 MB upload, OCR of at most 5 pages, pages rendered at a 2200 px long edge. The PDF never leaves the device for OCR; only recognized text is posted, and it is parsed in memory without being stored or logged. If the OCR engine cannot load (offline or CSP change), the text-layer draft is still applied and the agency can type the remaining fields manually.
