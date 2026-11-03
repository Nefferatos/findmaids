import { Buffer } from "node:buffer";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { assertStagingWriteAllowed } from "../lib/security/staging-guard";

// Server-side only: uses the service role key from the environment. Creates/updates the two buckets,
// checks storage policies, tests upload/download/limits, then deletes its test files.
assertStagingWriteAllowed();
const ref = process.env.STAGING_PROJECT_REF!;
const base = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const anonKey = process.env.SUPABASE_ANON_KEY ?? "";
if (!base.includes(ref) || !serviceKey)
  throw new Error("SUPABASE_URL must contain STAGING_PROJECT_REF and a service key must be set.");

const media = process.env.SUPABASE_MEDIA_BUCKET ?? "findmaids-media";
const priv = process.env.SUPABASE_PRIVATE_BUCKET ?? "findmaids-private";
const imageTypes = ["image/jpeg", "image/png", "image/webp"];
const wanted = [
  { id: media, public: true, file_size_limit: 5 * 1024 * 1024, allowed_mime_types: imageTypes },
  { id: priv, public: false, file_size_limit: 10 * 1024 * 1024, allowed_mime_types: ["application/pdf", ...imageTypes] },
];
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const results: { check: string; ok: boolean; detail?: string }[] = [];
const record = (check: string, ok: boolean, detail?: string) => {
  results.push({ check, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${check}${detail ? ` (${detail})` : ""}`);
};
const service = (extra: Record<string, string> = {}) => ({ Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, ...extra });
const anon = (extra: Record<string, string> = {}) => ({ Authorization: `Bearer ${anonKey}`, apikey: anonKey, ...extra });
const enc = (p: string) => p.split("/").map(encodeURIComponent).join("/");
const stamp = Date.now();
const created: { bucket: string; path: string }[] = [];

async function ensureBuckets() {
  const list = (await (await fetch(`${base}/storage/v1/bucket`, { headers: service() })).json()) as { id: string; public: boolean; file_size_limit: number | null; allowed_mime_types: string[] | null }[];
  for (const w of wanted) {
    const existing = list.find((b) => b.id === w.id);
    const body = JSON.stringify({ id: w.id, name: w.id, ...w });
    const res = existing
      ? await fetch(`${base}/storage/v1/bucket/${w.id}`, { method: "PUT", headers: service({ "Content-Type": "application/json" }), body })
      : await fetch(`${base}/storage/v1/bucket`, { method: "POST", headers: service({ "Content-Type": "application/json" }), body });
    const same = existing && existing.public === w.public && existing.file_size_limit === w.file_size_limit &&
      JSON.stringify([...(existing.allowed_mime_types ?? [])].sort()) === JSON.stringify([...w.allowed_mime_types].sort());
    record(`bucket ${w.id} ${existing ? (same ? "verified" : "updated to spec") : "created"}`, res.ok, `public=${w.public}, limit=${w.file_size_limit / 1048576} MB`);
  }
}

async function checkPolicies() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL, max: 1 }) });
  try {
    const rows = await prisma.$queryRaw<{ policyname: string; permissive: string; roles: string; cmd: string; qual: string | null }[]>`
      SELECT policyname::text, permissive::text, roles::text AS roles, cmd::text, qual::text FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'`;
    const rls = await prisma.$queryRaw<{ on: boolean; force: boolean }[]>`
      SELECT relrowsecurity AS on, relforcerowsecurity AS force FROM pg_class
      WHERE oid = 'storage.objects'::regclass`;
    record("RLS is enabled on storage.objects", rls[0]?.on === true, "with no permissive policy, anon/authenticated are denied");
    const open = rows.filter((r) => r.permissive === "PERMISSIVE" && /anon|authenticated|public/.test(r.roles) &&
      (r.cmd !== "SELECT" || !r.qual || r.qual.includes(priv) || !r.qual.includes(media)));
    record("no permissive anon/authenticated write or private-read policy", open.length === 0, open.map((r) => `${r.policyname}:${r.cmd}`).join(", ") || `${rows.length} policies reviewed`);
  } finally {
    await prisma.$disconnect();
  }
}

async function upload(bucket: string, path: string, type: string, body: Uint8Array, headers = service()) {
  const res = await fetch(`${base}/storage/v1/object/${bucket}/${enc(path)}`, { method: "POST", headers: { ...headers, "Content-Type": type }, body: body as BodyInit });
  if (res.ok) created.push({ bucket, path });
  return res;
}

async function main() {
  await ensureBuckets();
  await checkPolicies();

  const pPath = `_staging-test/${stamp}-private.png`;
  const up = await upload(priv, pPath, "image/png", png);
  record("service role can upload to private bucket", up.ok, `HTTP ${up.status}`);
  const sign = await fetch(`${base}/storage/v1/object/sign/${priv}/${enc(pPath)}`, { method: "POST", headers: service({ "Content-Type": "application/json" }), body: JSON.stringify({ expiresIn: 60 }) });
  const signed = sign.ok ? ((await sign.json()) as { signedURL?: string }).signedURL : undefined;
  record("signed URL created for private object", Boolean(signed), `HTTP ${sign.status}`);
  if (signed) {
    const dl = await fetch(`${base}/storage/v1${signed.startsWith("/") ? "" : "/"}${signed}`);
    record("signed URL downloads the private file", dl.ok && Buffer.from(await dl.arrayBuffer()).equals(png), `HTTP ${dl.status}`);
  }
  const privPublic = await fetch(`${base}/storage/v1/object/public/${priv}/${enc(pPath)}`);
  record("private object NOT readable via public URL", !privPublic.ok, `HTTP ${privPublic.status}`);

  const mPath = `_staging-test/${stamp}-media.png`;
  const mu = await upload(media, mPath, "image/png", png);
  record("service role can upload to media bucket", mu.ok, `HTTP ${mu.status}`);
  const pub = await fetch(`${base}/storage/v1/object/public/${media}/${enc(mPath)}`);
  record("media object readable via public URL", pub.ok && Buffer.from(await pub.arrayBuffer()).equals(png), `HTTP ${pub.status}`);

  const badType = await upload(media, `_staging-test/${stamp}-bad.txt`, "text/plain", Buffer.from("x"));
  record("media bucket rejects a non-image type", !badType.ok, `HTTP ${badType.status}`);
  const badPdf = await upload(media, `_staging-test/${stamp}-bad.pdf`, "application/pdf", Buffer.from("%PDF-1.4"));
  record("media bucket rejects PDF", !badPdf.ok, `HTTP ${badPdf.status}`);
  const big = await upload(media, `_staging-test/${stamp}-big.png`, "image/png", Buffer.alloc(5 * 1024 * 1024 + 1));
  record("media bucket rejects a file over 5 MB", !big.ok, `HTTP ${big.status}`);
  const pdf = await upload(priv, `_staging-test/${stamp}-proof.pdf`, "application/pdf", Buffer.from("%PDF-1.4\n%%EOF"));
  record("private bucket accepts PDF", pdf.ok, `HTTP ${pdf.status}`);
  const badPriv = await upload(priv, `_staging-test/${stamp}-bad.exe`, "application/octet-stream", Buffer.from("x"));
  record("private bucket rejects other types", !badPriv.ok, `HTTP ${badPriv.status}`);

  const noAuth = await fetch(`${base}/storage/v1/object/${media}/_staging-test/${stamp}-anon.png`, { method: "POST", headers: { "Content-Type": "image/png" }, body: png as BodyInit });
  record("unauthenticated upload is refused", !noAuth.ok, `HTTP ${noAuth.status}`);
  if (anonKey) {
    for (const b of [media, priv]) {
      const r = await upload(b, `_staging-test/${stamp}-anon-${b}.png`, "image/png", png, anon());
      record(`anon key cannot upload to ${b}`, !r.ok, `HTTP ${r.status}`);
    }
    const read = await fetch(`${base}/storage/v1/object/${priv}/${enc(pPath)}`, { headers: anon() });
    record("anon key cannot read the private bucket", !read.ok, `HTTP ${read.status}`);
  } else {
    console.log("SKIP anon-key checks (set SUPABASE_ANON_KEY in the environment to run them)");
  }
}

main()
  .catch((e: unknown) => record("script error", false, e instanceof Error ? e.message.split("\n")[0] : "unknown"))
  .finally(async () => {
    for (const bucket of new Set(created.map((c) => c.bucket))) {
      const prefixes = created.filter((c) => c.bucket === bucket).map((c) => c.path);
      const res = await fetch(`${base}/storage/v1/object/${bucket}`, { method: "DELETE", headers: service({ "Content-Type": "application/json" }), body: JSON.stringify({ prefixes }) });
      console.log(`${res.ok ? "PASS" : "FAIL"} deleted ${prefixes.length} test file(s) from ${bucket} (HTTP ${res.status})`);
    }
    console.log(`SUMMARY ${results.filter((r) => r.ok).length}/${results.length} checks passed`);
    process.exitCode = results.every((r) => r.ok) ? 0 : 1;
  });
