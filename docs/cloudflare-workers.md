# Deploying FindMaids to Cloudflare Workers

FindMaids uses Next.js App Router with OpenNext's Cloudflare adapter. The frontend and Next.js API routes run in the same Worker. PostgreSQL is hosted separately on Supabase.

## Cloudflare configuration

The Worker is configured in `wrangler.jsonc`, and `open-next.config.ts` selects the OpenNext Cloudflare adapter. The deployment scripts are:

```sh
npm run preview:cf
npm run deploy:cf
```

OpenNext currently warns that its build is not fully supported on Windows and may fail while creating symlinks. Build from WSL/Linux or Cloudflare Workers Builds. Node.js 20.19 or newer is required by this repository.

## Before deploying

1. In Cloudflare, create a Hyperdrive configuration connected to the Supabase PostgreSQL database. Add its returned ID to a `hyperdrive` binding named `HYPERDRIVE` in `wrangler.jsonc`. Use the Supabase staging project for a staging deployment and production only when ready.
2. Add the application's runtime secrets as Worker secrets in the Cloudflare dashboard or with `wrangler secret put`. At minimum, configure `DATABASE_URL` with the matching Supabase PostgreSQL connection string, `AUTH_SECRET`, and `TOTP_ENCRYPTION_KEY`. Add provider-specific secrets for the features you enable. Do not commit `.env` files or paste secret values into chat.
3. Configure the required public/runtime variables, including `NEXT_PUBLIC_SITE_URL`, `NEXTAUTH_URL`, `SUPABASE_URL`, and `SUPABASE_MEDIA_BUCKET` / `SUPABASE_PRIVATE_BUCKET`.
4. Apply the Prisma migrations to the matching database and configure the Supabase Storage buckets and access policies.
5. Run `npm run preview:cf` from WSL/Linux and verify the app and `/api/health`; then deploy with `npm run deploy:cf`.

The local `.env` files are for development and are not uploaded with a Worker. Never place database passwords, signing keys, service role keys, or provider API keys in `wrangler.jsonc` or `[vars]`.

Prisma uses the `pg` adapter and reads `HYPERDRIVE.connectionString` in the Worker runtime. Local Node.js continues to use `DATABASE_URL`.
