/**
 * Targeted maid migration: old ATS Supabase project -> this FindMaids project.
 *
 * Copies maid profiles and their real photo binaries for ONE destination agency.
 * It never restores a database dump, never touches other agencies, and never
 * writes to the source project (reads only).
 *
 *   # 0. which agencies can own the import?
 *   npm run maids:migrate
 *
 *   # 1. dry run (no writes at all)
 *   npm run maids:migrate -- --to-agency <agency-slug> --dry-run
 *
 *   # 2. test batch of 3 profiles
 *   npm run maids:migrate -- --to-agency <agency-slug> --limit 3 --confirm=<agency-slug>
 *
 *   # 3. verify what landed (DB row + every photo URL answers 200)
 *   npm run maids:migrate -- --to-agency <agency-slug> --verify
 *
 *   # 4. the rest (resumable: re-running skips what is already imported)
 *   npm run maids:migrate -- --to-agency <agency-slug> --confirm=<agency-slug>
 *
 * Source credentials come from the single git-ignored .env:
 *   SOURCE_SUPABASE_URL, SOURCE_SUPABASE_SERVICE_ROLE_KEY,
 *   SOURCE_STORAGE_BUCKET (default ats-applications),
 *   SOURCE_APP_DATA_TABLE / SOURCE_APP_DATA_ID (default app_data / default)
 *
 * Destination credentials are the existing app ones: DATABASE_URL/DIRECT_URL,
 * SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_MEDIA_BUCKET.
 */
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { AGENCY_MAID_LIMIT } from "../lib/maids";
import { maidColumns } from "../lib/maid-write";
import {
  readAgencyContact,
  readEmploymentHistory,
  readLanguageSkills,
  readMedical,
  readPreferences,
  readWorkAreas,
} from "../lib/maid-profile";
import { prisma } from "../lib/prisma-script";
import { storeObject } from "../lib/storage";
type Args = {
  toAgency?: string;
  confirm?: string;
  sourceAgency: string;
  limit?: number;
  references?: string[];
  maxPhotos: number;
  publish: boolean;
  publishSourcePublic: boolean;
  includeFolderPhotos: boolean;
  allowOverLimit: boolean;
  dryRun: boolean;
  verify: boolean;
  retries: number;
  outDir: string;
  help: boolean;
};

const option = (argv: string[], name: string) => {
  const hit = argv.find((arg) => arg.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const index = argv.indexOf(`--${name}`);
  const next = index >= 0 ? argv[index + 1] : undefined;
  return next && !next.startsWith("--") ? next : undefined;
};
const flag = (argv: string[], name: string) => argv.includes(`--${name}`);

function parseArgs(argv: string[]): Args {
  const references = option(argv, "references")
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const limit = option(argv, "limit");
  return {
    toAgency: option(argv, "to-agency"),
    confirm: option(argv, "confirm"),
    sourceAgency: option(argv, "source-agency") ?? "1",
    limit: limit ? Number(limit) : undefined,
    references,
    maxPhotos: Number(option(argv, "max-photos") ?? 6),
    publish: flag(argv, "publish"),
    publishSourcePublic: flag(argv, "publish-source-public"),
    includeFolderPhotos: flag(argv, "include-folder-photos"),
    allowOverLimit: flag(argv, "allow-over-limit"),
    dryRun: flag(argv, "dry-run"),
    verify: flag(argv, "verify"),
    retries: Math.max(1, Number(option(argv, "retries") ?? 3)),
    outDir: option(argv, "out") ?? "migration",
    help: flag(argv, "help"),
  };
}

function usage() {
  console.log(
    [
      "Usage: npm run maids:migrate -- [options]",
      "",
      "  --to-agency=<slug|owner-email>  destination agency that owns the imported profiles",
      "  --confirm=<agency-slug>         required for a real import; must equal the resolved slug",
      "  --source-agency=<id>            old ATS agencyId to read (default 1)",
      "  --limit=<n>                     import at most n profiles (test batch)",
      "  --references=A,B                only these source reference codes",
      "  --max-photos=<n>                photo cap per profile (default 6)",
      "  --publish                       publish every imported profile (default: stay unpublished)",
      "  --publish-source-public         publish only the profiles that were public in the source (isPublic)",
      "  --include-folder-photos         also copy photos/ images the source blob does not reference",
      "  --allow-over-limit              allow exceeding the per-agency profile cap",
      "  --dry-run                       report only; no uploads and no database writes",
      "  --verify                        re-check previously imported rows and photo URLs",
      "  --retries=<n>                   attempts per network call (default 3)",
      "  --out=<dir>                     state/report folder (default ./migration)",
      "",
      "Run without --to-agency to list the destination agencies and the source summary.",
    ].join("\n"),
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Retry with exponential backoff for network calls only. */
async function withRetry<T>(
  label: string,
  run: () => Promise<T>,
  attempts: number,
): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      last = error;
      if (attempt === attempts) break;
      await sleep(400 * 2 ** (attempt - 1));
    }
  }
  throw new Error(
    `${label} failed after ${attempts} attempt(s): ${last instanceof Error ? last.message : String(last)}`,
  );
}

const text = (input: unknown) =>
  typeof input === "string" ? input.trim() : "";
/** Same as `text` but keeps numbers (the old app stores agencyId and maid id as numbers). */
const scalar = (input: unknown) =>
  typeof input === "number" && Number.isFinite(input)
    ? String(input)
    : text(input);
const record = (input: unknown): Record<string, unknown> =>
  input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
const positive = (input: unknown) => {
  const number = Number(input);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
};

/** Repairs UTF-8 that was stored as latin1 ("High School (10â€“12 yrs)"). */
function fixEncoding(input: string) {
  if (!/â€|â‰|Ã|Â/.test(input)) return input;
  const decoded = Buffer.from(input, "latin1").toString("utf8");
  return decoded.includes("\uFFFD") ? input : decoded;
}
// ------------------------------------------------------------------ source side

type SourceMaid = Record<string, unknown> & { id?: number | string };

const sourceBase = (process.env.SOURCE_SUPABASE_URL ?? "")
  .trim()
  .replace(/\/$/, "");
const sourceKey = (process.env.SOURCE_SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
const sourceBucket =
  (process.env.SOURCE_STORAGE_BUCKET ?? "").trim() || "ats-applications";
const sourceTable =
  (process.env.SOURCE_APP_DATA_TABLE ?? "").trim() || "app_data";
const sourceRowId = (process.env.SOURCE_APP_DATA_ID ?? "").trim() || "default";

const sourceHeaders = () => ({
  apikey: sourceKey,
  Authorization: `Bearer ${sourceKey}`,
});

const sourceProjectRef = () => {
  try {
    return new URL(sourceBase).hostname.split(".")[0];
  } catch {
    return "unknown";
  }
};

function requireSourceConfig() {
  if (!sourceBase || !sourceKey)
    throw new Error(
      "Set SOURCE_SUPABASE_URL and SOURCE_SUPABASE_SERVICE_ROLE_KEY in the git-ignored .env (see docs/MAID_MIGRATION.md).",
    );
}

/** GET only: the source project is never written to. */
async function sourceGet(pathname: string, attempts: number) {
  return withRetry(
    `source GET ${pathname}`,
    async () => {
      const response = await fetch(`${sourceBase}${pathname}`, {
        headers: sourceHeaders(),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    },
    attempts,
  );
}

type SourceEntry = {
  name: string;
  id?: string | null;
  metadata?: { size?: number; mimetype?: string } | null;
};

/**
 * Storage listing is the one POST used against the source, and it only enumerates
 * objects (the Storage API has no GET equivalent). No mutation is ever sent.
 */
async function sourceList(prefix: string, attempts: number) {
  const items: SourceEntry[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await withRetry(
      `source list ${prefix || "/"}`,
      async () => {
        const response = await fetch(
          `${sourceBase}/storage/v1/object/list/${encodeURIComponent(sourceBucket)}`,
          {
            method: "POST",
            headers: { ...sourceHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({
              prefix,
              limit: 100,
              offset,
              sortBy: { column: "name", order: "asc" },
            }),
          },
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return (await response.json()) as SourceEntry[];
      },
      attempts,
    );
    items.push(...page);
    if (page.length < 100) break;
  }
  return items;
}

async function loadSourceMaids(attempts: number) {
  const response = await sourceGet(
    `/rest/v1/${sourceTable}?select=data&id=eq.${encodeURIComponent(sourceRowId)}`,
    attempts,
  );
  const rows = (await response.json()) as { data?: Record<string, unknown> }[];
  if (!rows.length)
    throw new Error(`Source ${sourceTable} has no row with id=${sourceRowId}.`);
  const data = record(rows[0].data);
  const maids = Array.isArray(data.maids) ? (data.maids as SourceMaid[]) : [];
  if (!maids.length) throw new Error("Source blob has no maids array.");
  return { maids, blobKeys: Object.keys(data) };
}
type PhotoIndex = {
  /** `maids/agency-1/<ref>/` -> every object path directly under `photos/`. */
  folderPhotos: Map<string, string[]>;
  objects: number;
  bytes: number;
  mimetypes: Map<string, number>;
  referenceFolders: number;
  agencyFolders: string[];
};

async function discoverPhotoIndex(
  attempts: number,
  log: boolean,
): Promise<PhotoIndex> {
  const folderPhotos = new Map<string, string[]>();
  const mimetypes = new Map<string, number>();
  let objects = 0;
  let bytes = 0;
  let referenceFolders = 0;

  const agencyFolders = (await sourceList("maids/", attempts))
    .filter((entry) => !entry.id)
    .map((entry) => entry.name.replace(/\/$/, ""));

  for (const agency of agencyFolders) {
    const refs = (await sourceList(`maids/${agency}/`, attempts)).filter(
      (entry) => !entry.id,
    );
    referenceFolders += refs.length;
    if (log) console.log(`  ${agency}: ${refs.length} reference folder(s)`);
    for (const ref of refs) {
      const folder = `maids/${agency}/${ref.name.replace(/\/$/, "")}/`;
      const files = (await sourceList(`${folder}photos/`, attempts)).filter(
        (entry) => entry.id,
      );
      folderPhotos.set(
        folder,
        files.map((file) => `${folder}photos/${file.name}`),
      );
      objects += files.length;
      for (const file of files) {
        bytes += Number(file.metadata?.size) || 0;
        const mime = String(file.metadata?.mimetype ?? "unknown");
        mimetypes.set(mime, (mimetypes.get(mime) ?? 0) + 1);
      }
    }
  }
  return {
    folderPhotos,
    objects,
    bytes,
    mimetypes,
    referenceFolders,
    agencyFolders,
  };
}

/** Legacy value (relative path or full public URL) -> bucket-relative object path. */
function normalizeSourcePath(raw: string) {
  let value = raw.trim().split("?")[0];
  if (!value) return "";
  const publicMarker = `/object/public/${sourceBucket}/`;
  if (value.includes(publicMarker))
    value = value.slice(value.indexOf(publicMarker) + publicMarker.length);
  else if (value.includes(`/${sourceBucket}/`))
    value = value.slice(
      value.indexOf(`/${sourceBucket}/`) + sourceBucket.length + 2,
    );
  value = value.replace(/^\/+/, "");
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function downloadSourceObject(pathname: string, attempts: number) {
  const encoded = pathname.split("/").map(encodeURIComponent).join("/");
  const response = await withRetry(
    `download ${pathname}`,
    async () => {
      const res = await fetch(
        `${sourceBase}/storage/v1/object/${encodeURIComponent(sourceBucket)}/${encoded}`,
        { headers: sourceHeaders() },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    },
    attempts,
  );
  return Buffer.from(await response.arrayBuffer());
}

/** Every photo path a source maid points at, de-duplicated and normalized. */
function sourcePhotoPaths(maid: SourceMaid) {
  const raw = [
    ...(Array.isArray(maid.photoDataUrls) ? maid.photoDataUrls : []),
    ...(Array.isArray(maid.photoPortraitDataUrls)
      ? maid.photoPortraitDataUrls
      : []),
    ...(Array.isArray(maid.photoThumbnailDataUrls)
      ? maid.photoThumbnailDataUrls
      : []),
    ...(maid.photoDataUrl ? [maid.photoDataUrl] : []),
  ]
    .map((item) => (typeof item === "string" ? normalizeSourcePath(item) : ""))
    .filter(Boolean);
  return [...new Set(raw)];
}

/** The folder the source keeps this maid's images in. */
function sourceFolderFor(maid: SourceMaid) {
  return `maids/agency-${scalar(maid.agencyId)}/${text(maid.referenceCode)}/`;
}
// ------------------------------------------------------------- destination side

type AgencyChoice = {
  id: string;
  name: string;
  slug: string;
  maids: number;
  published: number;
};

async function destinationAgencies(): Promise<AgencyChoice[]> {
  const agencies = await prisma.agency.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });
  const totals = await prisma.maid.groupBy({
    by: ["agencyId"],
    _count: { _all: true },
  });
  const publicTotals = await prisma.maid.groupBy({
    by: ["agencyId"],
    where: { published: true },
    _count: { _all: true },
  });
  const total = new Map(totals.map((row) => [row.agencyId, row._count._all]));
  const publicCount = new Map(
    publicTotals.map((row) => [row.agencyId, row._count._all]),
  );
  return agencies.map((agency) => ({
    ...agency,
    maids: total.get(agency.id) ?? 0,
    published: publicCount.get(agency.id) ?? 0,
  }));
}

/** Exact slug or owner email only; unknown selectors fail instead of guessing. */
async function resolveAgency(selector: string) {
  const needle = selector.trim();
  const bySlug = await prisma.agency.findFirst({
    where: { slug: needle },
    select: { id: true, name: true, slug: true },
  });
  if (bySlug) return bySlug;
  const user = await prisma.user.findFirst({
    where: { email: needle.toLowerCase() },
    select: { id: true },
  });
  if (user) {
    const owned = await prisma.agency.findFirst({
      where: { ownerId: user.id },
      select: { id: true, name: true, slug: true },
    });
    if (owned) return owned;
  }
  throw new Error(
    `No destination agency matches "${needle}". Pass an exact agency slug or the owner's login email; nothing was guessed.`,
  );
}

function requireDestinationConfig() {
  const url = (process.env.SUPABASE_URL ?? "").trim().replace(/\/$/, "");
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !key)
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.",
    );
  if (sourceBase && url === sourceBase)
    throw new Error(
      "Destination and source are the same Supabase project. Refusing to run.",
    );
  return {
    url,
    key,
    bucket:
      (process.env.SUPABASE_MEDIA_BUCKET ?? "").trim() || "findmaids-media",
  };
}

// ------------------------------------------------------------------- mapping

const NATIONALITY_MAP: [RegExp, string][] = [
  [/filipin/i, "Filipino maid"],
  [/indones/i, "Indonesian maid"],
  [/myanmar|burm/i, "Myanmar maid"],
  [/indian/i, "Indian maid"],
];

const PLACEMENT_MAP: [RegExp, string][] = [
  [/^new to singapore$/i, "New maid"],
  [/^ex-singapore helper$/i, "Ex-Singapore maid"],
  [/transfer helper/i, "Transfer maid"],
  [/^ex-?malaysia/i, "Ex-Malaysia maid"],
];

const EDUCATION_MAP: [RegExp, string][] = [
  [/primary/i, "Primary (1-6 yrs)"],
  [/secondary|grade (7|8|9)\b/i, "Secondary Level (7-9 yrs)"],
  [/high school|10th|grade 10/i, "High School (10-12 yrs)"],
  [/college|degree|university/i, "College/Degree (>=13 yrs)"],
];

const STATUS_MAP: Record<string, "AVAILABLE" | "ON_HOLD" | "PLACED"> = {
  available: "AVAILABLE",
  reserved: "ON_HOLD",
  "on hold": "ON_HOLD",
  hold: "ON_HOLD",
  placed: "PLACED",
};

function normalizeNationality(raw: string) {
  if (!raw) return "Not stated";
  const hit = NATIONALITY_MAP.find(([pattern]) => pattern.test(raw));
  return hit ? hit[1] : raw.slice(0, 60);
}

function normalizePlacementType(raw: string) {
  if (!raw) return "New maid";
  const hit = PLACEMENT_MAP.find(([pattern]) => pattern.test(raw));
  return (hit ? hit[1] : raw).slice(0, 80);
}

function normalizeEducation(raw: string) {
  if (!raw) return null;
  const hit = EDUCATION_MAP.find(([pattern]) => pattern.test(raw));
  return (hit ? hit[1] : raw).slice(0, 80);
}

function normalizeStatus(raw: string) {
  return STATUS_MAP[raw.trim().toLowerCase()] ?? "AVAILABLE";
}

/** "$450 + $35" -> 450 (first 3-5 digit amount). */
function money(raw: string) {
  const match = /\d{3,5}/.exec(raw);
  return match ? Number(match[0]) : null;
}

function isoDate(raw: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!match) return undefined;
  const date = new Date(`${match[0]}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** `--publish` wins; `--publish-source-public` keeps the source visibility flag. */
const publishFor = (args: Args, src: SourceMaid) =>
  args.publish || (args.publishSourcePublic && src.isPublic === true);
type MapContext = { photoUrls: string[]; agencyName: string; publish: boolean };

type MappedMaid = {
  reference: string;
  sourceId: string;
  wasPublic: boolean;
  issues: string[];
  data: Record<string, unknown>;
};

/**
 * Explicit field mapping. Nothing from the source row is inserted blindly:
 * unknown vocabulary is normalized, non-destination fields (passportNo,
 * evaluation, agesOfChildren...) are dropped or folded into notes, and photos are
 * the freshly uploaded destination URLs.
 */
function mapMaid(src: SourceMaid, context: MapContext): MappedMaid {
  const issues: string[] = [];
  const reference = fixEncoding(text(src.referenceCode)).slice(0, 40);
  const intro = record(src.introduction);
  const prefs = record(src.skillsPreferences);
  const languageSkills = readLanguageSkills(src.languageSkills);
  const workAreas = readWorkAreas(src.workAreas);

  const languages = Object.entries(languageSkills)
    .filter(([, proficiency]) => proficiency && proficiency !== "Zero")
    .map(([language]) => language)
    .slice(0, 12);
  if (languages.length === 0) issues.push("no language skills -> languages []");

  // `evaluation`/`yearsOfExperience` stay as the destination defines them; the
  // destination has no ratings here, so "willing" keeps the skills visible.
  const duties = Object.entries(workAreas)
    .filter(([area]) => area !== "Language abilities (spoken)")
    .filter(
      ([, area]) => (area.rating ?? 0) >= 3 || area.experience || area.willing,
    )
    .map(([area]) => area)
    .slice(0, 20);

  const agencyContact = readAgencyContact(src.agencyContact);
  if (!agencyContact.companyName)
    agencyContact.companyName = context.agencyName.slice(0, 160);

  const nationalityRaw = fixEncoding(text(src.nationality));
  const nationality = normalizeNationality(nationalityRaw);
  if (!nationalityRaw) issues.push('blank nationality -> "Not stated"');

  const typeRaw = fixEncoding(text(src.type));
  const placementType = normalizePlacementType(typeRaw);
  if (!typeRaw) issues.push('blank placement type -> "New maid"');
  else if (placementType !== typeRaw)
    issues.push(`placement "${typeRaw}" -> "${placementType}"`);

  const educationRaw = fixEncoding(text(src.educationLevel));
  const educationLevel = normalizeEducation(educationRaw);
  if (educationLevel && educationRaw && educationLevel !== educationRaw)
    issues.push(`education "${educationRaw}" -> "${educationLevel}"`);
  if (!educationLevel) issues.push("blank education level -> null");

  const heightCm = positive(src.height);
  if (heightCm === null) issues.push("height missing/0 -> null");

  const dateOfBirth = isoDate(text(src.dateOfBirth));
  if (text(src.dateOfBirth) && !dateOfBirth)
    issues.push(`unparseable dateOfBirth "${text(src.dateOfBirth)}" -> null`);

  const notes: string[] = [];
  if (text(intro.agesOfChildren))
    notes.push(`Ages of children: ${text(intro.agesOfChildren)}`);
  if (educationLevel && educationRaw && educationLevel !== educationRaw)
    notes.push(`Original education level: ${educationRaw}`);

  const presentSalary = money(text(intro.presentSalary));
  const monthlySalary = presentSalary ?? money(text(intro.intro));

  // Destination `videoUrl` only accepts real URLs; the source stores bucket
  // paths there, so anything that is not http(s) is reported and dropped.
  const videoRaw = text(src.videoDataUrl);
  const videoUrl = /^https?:\/\//i.test(videoRaw) ? videoRaw.slice(0, 500) : "";
  if (videoRaw && !videoUrl)
    issues.push(
      "videoDataUrl is a storage path, not a URL -> videoUrl left empty",
    );

  const createdRaw = text(src.createdAt);
  const created = createdRaw ? new Date(createdRaw) : null;
  if (createdRaw && Number.isNaN(created?.getTime() ?? Number.NaN))
    issues.push(`unparseable createdAt "${createdRaw}" -> now()`);

  const data = {
    ...maidColumns({
      reference,
      fullName: fixEncoding(text(src.fullName)).slice(0, 120),
      nationality,
      placementType,
      dateOfBirth,
      placeOfBirth: fixEncoding(text(src.placeOfBirth)),
      heightCm,
      weightKg: positive(src.weight),
      religion: fixEncoding(text(src.religion)),
      maritalStatus: fixEncoding(text(src.maritalStatus)),
      childrenCount: positive(src.numberOfChildren) ?? 0,
      siblingsCount: positive(src.numberOfSiblings) ?? 0,
      homeAddress: text(src.homeAddress),
      airportRepatriation: text(src.airportRepatriation),
      educationLevel: educationLevel ?? undefined,
      languages,
      duties,
      monthlySalary,
      presentSalary,
      status: normalizeStatus(text(src.status)),
      availability: text(intro.availability),
      contractEnds: text(intro.contractEnds),
      offDaysPerMonth: positive(prefs.offDaysPerMonth),
      foodHandlingPreferences: text(intro.foodHandlingPreferences),
      dietaryRestrictions: text(intro.dietaryRestrictions),
      introduction: fixEncoding(text(intro.intro)),
      notes: notes.join("\n"),
      languageSkills,
      preferences: readPreferences({
        ...prefs,
        availabilityRemark: text(intro.availability),
      }),
      workAreas,
      employmentHistory: readEmploymentHistory(src.employmentHistory),
      medicalInfo: readMedical({
        pastIllnesses: intro.pastIllnesses,
        otherIllnesses: intro.otherIllnesses,
        allergies: intro.allergies,
        physicalDisabilities: intro.physicalDisabilities,
        otherRemarks: intro.otherRemarks,
      }),
      agencyContact,
      photoUrls: context.photoUrls,
      photoUrl: context.photoUrls[0] ?? "",
      videoUrl,
      published: context.publish,
    } as never),
    ...(created && !Number.isNaN(created.getTime())
      ? { createdAt: created }
      : {}),
  } as Record<string, unknown>;

  return {
    reference,
    sourceId: scalar(src.id),
    wasPublic: src.isPublic === true,
    issues,
    data,
  };
}
// --------------------------------------------------------------- resumable state

type StatePhotoMap = Record<string, string>;

type StateEntry = {
  reference: string;
  sourceId: string;
  status: "imported" | "skipped" | "failed";
  destinationId?: string;
  reason?: string;
  error?: string;
  photoUrls?: string[];
  attempts: number;
  updatedAt: string;
};

type MigrationState = {
  version: 1;
  source: {
    project: string;
    bucket: string;
    table: string;
    rowId: string;
    agencyId: string;
  };
  destination: {
    project: string;
    agencyId: string;
    agencySlug: string;
    bucket: string;
  };
  updatedAt: string;
  photos: StatePhotoMap;
  maids: Record<string, StateEntry>;
};

function stateFile(args: Args, agencySlug: string) {
  mkdirSync(path.resolve(args.outDir), { recursive: true });
  return path.resolve(args.outDir, `maid-migrate-${agencySlug}.json`);
}

function loadState(
  file: string,
  meta: {
    agencyId: string;
    agencySlug: string;
    project: string;
    bucket: string;
    sourceProject: string;
  },
): MigrationState {
  if (!existsSync(file)) {
    return {
      version: 1,
      source: {
        project: meta.sourceProject,
        bucket: sourceBucket,
        table: sourceTable,
        rowId: sourceRowId,
        agencyId: meta.agencyId,
      },
      destination: {
        project: meta.project,
        agencyId: meta.agencyId,
        agencySlug: meta.agencySlug,
        bucket: meta.bucket,
      },
      updatedAt: new Date().toISOString(),
      photos: {},
      maids: {},
    } as MigrationState;
  }
  const state = JSON.parse(readFileSync(file, "utf8")) as MigrationState;
  if (state.destination?.agencyId !== meta.agencyId)
    throw new Error(
      `State file ${file} belongs to another destination agency (${state.destination?.agencyId}). Refusing to mix them.`,
    );
  if (state.source?.project !== meta.sourceProject)
    throw new Error(
      `State file ${file} was written for source project ${state.source?.project}.`,
    );
  return state;
}

function saveState(file: string, state: MigrationState) {
  state.updatedAt = new Date().toISOString();
  writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

// ----------------------------------------------------------------- photo copying

const PHOTO_FORMATS = new Set(["jpeg", "png", "webp", "gif"]);

/** Same pipeline the agency media route applies to `kind: "maid"`. */
async function prepareImage(input: Buffer) {
  const image = sharp(input, { limitInputPixels: 40_000_000, failOn: "error" });
  const metadata = await image.metadata();
  if (!metadata.format || !PHOTO_FORMATS.has(metadata.format))
    throw new Error(
      `unsupported image format "${metadata.format ?? "unknown"}"`,
    );
  return image
    .rotate()
    .resize({
      width: 800,
      height: 800,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
}

/**
 * Downloads one source object, re-encodes it like the dashboard does, and stores
 * it under a fresh UUID key in the destination media bucket. Keys are never
 * reused, so an existing file can never be overwritten; the state file caches
 * the result so a re-run does not upload the same photo twice.
 */
async function copyPhoto(
  sourcePath: string,
  agencySlug: string,
  reference: string,
  state: MigrationState,
  file: string,
  attempts: number,
) {
  const cached = state.photos[sourcePath];
  if (cached) return { url: cached, reused: true };

  const input = await downloadSourceObject(sourcePath, attempts);
  const output = await prepareImage(input);
  const key = `maids/${slugify(agencySlug)}/${slugify(reference)}/${randomUUID()}.webp`;
  const url = await withRetry(
    `upload ${key}`,
    () =>
      storeObject({
        bucket: "media",
        key,
        body: output,
        contentType: "image/webp",
        public: true,
      }),
    attempts,
  );
  state.photos[sourcePath] = url;
  saveState(file, state);
  return { url, reused: false };
}
// ------------------------------------------------------------- planning / report

type PlanItem = {
  src: SourceMaid;
  mapped: MappedMaid;
  photoPaths: string[];
  missingPhotos: string[];
  skip?: string;
};

function identityKey(fullName: unknown, dateOfBirth: unknown) {
  const name = fixEncoding(text(fullName))
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const date =
    dateOfBirth instanceof Date
      ? dateOfBirth.toISOString().slice(0, 10)
      : text(dateOfBirth).slice(0, 10);
  return name && date ? `${name}|${date}` : "";
}

async function buildPlan(input: {
  args: Args;
  maids: SourceMaid[];
  index: PhotoIndex;
  agency: { id: string; name: string; slug: string };
  state: MigrationState;
}) {
  const { args, maids, index, agency, state } = input;
  const existing = await prisma.maid.findMany({
    where: { agencyId: agency.id },
    select: { id: true, reference: true, fullName: true, dateOfBirth: true },
  });
  const existingRefs = new Map(
    existing.map((row) => [row.reference.trim().toLowerCase(), row.id]),
  );
  const existingIdentities = new Map(
    existing
      .map(
        (row) =>
          [identityKey(row.fullName, row.dateOfBirth), row.id] as [
            string,
            string,
          ],
      )
      .filter(([key]) => key !== ""),
  );

  const inScope = maids.filter(
    (maid) => scalar(maid.agencyId) === args.sourceAgency,
  );
  const wanted = args.references ? new Set(args.references) : null;
  const seenRefs = new Set<string>();
  const seenIdentities = new Set<string>();
  const items: PlanItem[] = [];

  for (const src of inScope) {
    const reference = fixEncoding(text(src.referenceCode));
    if (wanted && !wanted.has(reference)) continue;

    const folder = sourceFolderFor(src);
    const folderFiles = index.folderPhotos.get(folder) ?? [];
    const known = new Set(folderFiles);
    const referenced = sourcePhotoPaths(src);
    const candidates = args.includeFolderPhotos
      ? [...new Set([...referenced, ...folderFiles])]
      : referenced;
    const missingPhotos = candidates.filter((item) => !known.has(item));
    const photoPaths = candidates
      .filter((item) => known.has(item))
      .slice(0, args.maxPhotos);

    const mapped = mapMaid(src, {
      photoUrls: [],
      agencyName: agency.name,
      publish: publishFor(args, src),
    });
    const item: PlanItem = { src, mapped, photoPaths, missingPhotos };

    const identity = identityKey(src.fullName, src.dateOfBirth);
    const refKey = reference.trim().toLowerCase();
    if (!mapped.reference) item.skip = "missing referenceCode";
    else if (state.maids[mapped.sourceId]?.status === "imported")
      item.skip = "already imported (state file)";
    else if (existingRefs.has(refKey))
      item.skip = "reference already exists in the destination agency";
    else if (identity && existingIdentities.has(identity))
      item.skip = "same full name + date of birth already exists";
    else if (seenRefs.has(refKey))
      item.skip = "duplicate reference inside the source batch";
    else if (identity && seenIdentities.has(identity))
      item.skip = "duplicate full name + date of birth inside the source batch";

    if (!item.skip) {
      seenRefs.add(refKey);
      if (identity) seenIdentities.add(identity);
    }
    items.push(item);
  }

  const importable = items.filter((item) => !item.skip);
  if (args.limit && args.limit > 0) {
    for (const item of importable.slice(args.limit))
      item.skip = `deferred: beyond --limit ${args.limit}`;
  }
  return items;
}

function printMappingTable(args: Args) {
  const rows: [string, string][] = [
    ["referenceCode", "reference (required, unique per agency)"],
    ["fullName", "fullName"],
    ["nationality", "nationality (normalized to the 4 supported labels)"],
    ["type", "placementType (Ex-Singapore Helper -> Ex-Singapore maid, ...)"],
    ["dateOfBirth (YYYY-MM-DD)", "dateOfBirth + derived age"],
    ["height / weight", "heightCm / weightKg (0 or blank -> null)"],
    [
      "religion / maritalStatus",
      "religion / maritalStatus (mojibake repaired)",
    ],
    ["numberOfChildren / numberOfSiblings", "childrenCount / siblingsCount"],
    ["placeOfBirth / homeAddress / airportRepatriation", "same column names"],
    ["educationLevel", "educationLevel (normalized to the 4 portal labels)"],
    ["languageSkills", "languageSkills + languages[] (proficiency != Zero)"],
    ["workAreas", "workAreas + duties[] (willing/experience/rating >= 3)"],
    ["employmentHistory", "employmentHistory"],
    ["introduction.intro", "introduction"],
    ["introduction.pastIllnesses / allergies / ...", "medicalInfo"],
    ["introduction.presentSalary", "presentSalary + monthlySalary"],
    ["introduction.foodHandlingPreferences", "foodHandlingPreferences"],
    ["introduction.agesOfChildren", "notes (no destination field)"],
    ["skillsPreferences", "preferences (evaluationMethods dropped)"],
    ["agencyContact", "agencyContact (passportNo dropped)"],
    ["status (available)", "status = AVAILABLE"],
    [
      "isPublic",
      args.publish
        ? "published = true (--publish)"
        : args.publishSourcePublic
          ? "published = source isPublic (--publish-source-public)"
          : "published = false (default)",
    ],
    [
      "photoDataUrls[] + portrait/thumbnail",
      "photoUrls[] + photoUrl, re-encoded WebP in the media bucket",
    ],
  ];
  console.log("\nField mapping (source -> destination):");
  for (const [from, to] of rows) console.log(`  ${from.padEnd(42)} -> ${to}`);
}
type ReportBag = {
  args: Args;
  agency: { id: string; name: string; slug: string };
  agencyCounts: { maids: number; published: number };
  destination: { project: string; bucket: string };
  source: { total: number; inScope: number; blobKeys: string[] };
  index: PhotoIndex;
  items: PlanItem[];
};

function groupReasons(items: PlanItem[]) {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!item.skip) continue;
    const reason = item.skip.replace(/:.*$/, "");
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]);
}

function printRunReport(bag: ReportBag) {
  const { args, agency, agencyCounts, destination, source, index, items } = bag;
  const importable = items.filter((item) => !item.skip);
  const skipped = items.filter((item) => item.skip);
  const present = items.reduce((sum, item) => sum + item.photoPaths.length, 0);
  const missing = items.reduce(
    (sum, item) => sum + item.missingPhotos.length,
    0,
  );
  const withPhotos = importable.filter(
    (item) => item.photoPaths.length > 0,
  ).length;
  const unreferenced = Math.max(0, index.objects - present);
  const issueCounts = new Map<string, number>();
  for (const item of items)
    for (const issue of item.mapped.issues)
      issueCounts.set(issue, (issueCounts.get(issue) ?? 0) + 1);

  console.log(
    `\n=== Maid migration: ${args.dryRun ? "DRY RUN" : "IMPORT PLAN"} ===`,
  );
  console.log(
    `source       ${sourceProjectRef()} | ${sourceTable}.data.maids (id=${sourceRowId}) | bucket ${sourceBucket}`,
  );
  console.log(
    `destination  ${destination.project} | media bucket ${destination.bucket}`,
  );
  console.log(
    `agency       ${agency.name} (${agency.slug}) | id ${agency.id} | ${agencyCounts.maids} profiles (${agencyCounts.published} public) | cap ${AGENCY_MAID_LIMIT}`,
  );
  console.log(
    `profiles     ${source.total} in blob | ${source.inScope} in source agency ${args.sourceAgency} | ${items.length} selected`,
  );
  console.log(
    `photos       ${present + missing} referenced | ${present} present in storage | ${missing} missing | ${index.objects} object(s) in bucket (${(index.bytes / 1048576).toFixed(1)} MB) | ${unreferenced} unreferenced`,
  );
  console.log(
    `cap check    ${agencyCounts.maids + importable.length}/${AGENCY_MAID_LIMIT} after import`,
  );
  console.log(
    `\nwill import  ${importable.length} profile(s), ${importable.reduce((n, i) => n + i.photoPaths.length, 0)} photo(s) (${withPhotos} with photos, ${importable.length - withPhotos} without)`,
  );
  console.log(`will skip    ${skipped.length}`);
  for (const [reason, count] of groupReasons(skipped))
    console.log(`  ${String(count).padStart(4)} x ${reason}`);

  if (skipped.length) {
    console.log("\nSkipped profiles:");
    for (const item of skipped.slice(0, 20))
      console.log(
        `  ${item.mapped.reference || "(no reference)"} - ${item.skip}`,
      );
    if (skipped.length > 20) console.log(`  ... ${skipped.length - 20} more`);
  }

  const missingSamples = items
    .flatMap((item) => item.missingPhotos)
    .slice(0, 5);
  if (missingSamples.length) {
    console.log(
      "\nPhotos referenced by the source blob but absent from storage:",
    );
    for (const sample of missingSamples) console.log(`  ${sample}`);
  }

  if (issueCounts.size) {
    console.log("\nMapping notes (aggregated):");
    for (const [issue, count] of [...issueCounts].sort((a, b) => b[1] - a[1]))
      console.log(`  ${String(count).padStart(4)} x ${issue}`);
  }
  return { importable, skipped, present, missing, unreferenced };
}

function printDecisions(
  bag: ReportBag,
  summary: { importable: PlanItem[]; missing: number; unreferenced: number },
) {
  const { args, agencyCounts, index, items } = bag;
  const folderRefs = new Set(
    items.map((item) =>
      sourceFolderFor(item.src).replace(/\/$/, "").toLowerCase(),
    ),
  );
  const foldersWithoutProfile = index.referenceFolders - folderRefs.size;

  console.log("\nIncompatibilities / decisions:");
  const notes: string[] = [];
  notes.push(
    agencyCounts.maids + summary.importable.length > AGENCY_MAID_LIMIT
      ? `Agency cap is ${AGENCY_MAID_LIMIT}; this batch reaches ${agencyCounts.maids + summary.importable.length}. Split the batch or pass --allow-over-limit.`
      : `Within the ${AGENCY_MAID_LIMIT}-profile agency cap.`,
  );
  if (summary.missing > 0)
    notes.push(
      `${summary.missing} referenced photo(s) are missing in the source bucket; those profiles import without them.`,
    );
  if (summary.unreferenced > 0)
    notes.push(
      `${summary.unreferenced} bucket image(s) are not used by this batch (folder extras or profiles that were skipped).`,
    );
  if (foldersWithoutProfile > 0)
    notes.push(
      `${foldersWithoutProfile} storage folder(s) have no matching blob profile; they are ignored.`,
    );
  const nonImage = [...index.mimetypes].filter(
    ([mime]) => !mime.startsWith("image/"),
  );
  if (nonImage.length)
    notes.push(
      `Non-image objects in the bucket: ${nonImage.map(([mime, n]) => `${mime}x${n}`).join(", ")}.`,
    );
  notes.push(
    "Dropped source fields with no destination column: passportNo, evaluationMethods, agesOfChildren (moved to notes).",
  );
  notes.push(
    `Visibility: ${
      args.publish
        ? "every imported profile is PUBLISHED"
        : args.publishSourcePublic
          ? "published only where the source isPublic was true"
          : "all imported profiles stay unpublished (pass --publish to go live)"
    }.`,
  );
  for (const note of notes) console.log(`  - ${note}`);

  printMappingTable(args);
}

function writePlanReport(bag: ReportBag) {
  const { args, agency, agencyCounts, destination, items } = bag;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  mkdirSync(path.resolve(args.outDir), { recursive: true });
  const file = path.resolve(
    args.outDir,
    `maid-migration-plan-${agency.slug}-${stamp}.json`,
  );
  writeFileSync(
    file,
    `${JSON.stringify(
      {
        kind: "findmaids-maid-migration-plan",
        createdAt: new Date().toISOString(),
        mode: args.dryRun ? "dry-run" : "import",
        source: {
          project: sourceProjectRef(),
          table: `${sourceTable}.data.maids`,
          rowId: sourceRowId,
          bucket: sourceBucket,
          agencyId: args.sourceAgency,
        },
        destination,
        agency: {
          ...agency,
          currentMaids: agencyCounts.maids,
          currentPublished: agencyCounts.published,
          cap: AGENCY_MAID_LIMIT,
        },
        totals: {
          selected: items.length,
          import: items.filter((item) => !item.skip).length,
          skip: items.filter((item) => item.skip).length,
          photos: items.reduce((sum, item) => sum + item.photoPaths.length, 0),
          photosMissing: items.reduce(
            (sum, item) => sum + item.missingPhotos.length,
            0,
          ),
        },
        items: items.map((item) => ({
          sourceId: item.mapped.sourceId,
          reference: item.mapped.reference,
          wasPublic: item.mapped.wasPublic,
          publish: publishFor(args, item.src),
          skip: item.skip ?? null,
          photos: item.photoPaths,
          photosMissing: item.missingPhotos,
          issues: item.mapped.issues,
        })),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.log(`\nPlan written to ${file}`);
  return file;
}
// ------------------------------------------------------------------- importing

async function createMaidWithAudit(input: {
  agencyId: string;
  data: Record<string, unknown>;
  metadata: Record<string, unknown>;
}) {
  return prisma.$transaction(async (tx) => {
    const maid = await tx.maid.create({ data: input.data as never });
    await tx.auditLog.create({
      data: {
        agencyId: input.agencyId,
        action: "MAID_MIGRATED",
        entity: "Maid",
        entityId: maid.id,
        metadata: input.metadata as never,
      },
    });
    return maid;
  });
}

type ImportStats = {
  created: number;
  failed: number;
  photosUploaded: number;
  photosReused: number;
  photosFailed: number;
};

async function runImport(input: {
  args: Args;
  agency: { id: string; name: string; slug: string };
  items: PlanItem[];
  state: MigrationState;
  file: string;
}) {
  const { args, agency, items, state, file } = input;
  const queue = items.filter((item) => !item.skip);
  const stats: ImportStats = {
    created: 0,
    failed: 0,
    photosUploaded: 0,
    photosReused: 0,
    photosFailed: 0,
  };
  const previous = (sourceId: string) => state.maids[sourceId];
  let position = 0;

  for (const item of queue) {
    position += 1;
    const name = item.mapped.data.fullName;
    const label = `[${position}/${queue.length}] ${item.mapped.reference}${name ? ` (${name})` : ""}`;
    const photoUrls: string[] = [];
    const failures: string[] = [];

    for (const sourcePath of item.photoPaths) {
      try {
        const { url, reused } = await copyPhoto(
          sourcePath,
          agency.slug,
          item.mapped.reference,
          state,
          file,
          args.retries,
        );
        photoUrls.push(url);
        if (reused) stats.photosReused += 1;
        else stats.photosUploaded += 1;
      } catch (error) {
        stats.photosFailed += 1;
        failures.push(
          `${sourcePath}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (item.photoPaths.length > 0 && photoUrls.length === 0) {
      state.maids[item.mapped.sourceId] = {
        reference: item.mapped.reference,
        sourceId: item.mapped.sourceId,
        status: "failed",
        error: `all ${item.photoPaths.length} photo(s) failed to copy`,
        attempts: (previous(item.mapped.sourceId)?.attempts ?? 0) + 1,
        updatedAt: new Date().toISOString(),
      };
      saveState(file, state);
      stats.failed += 1;
      console.log(`${label} | FAILED (no photo could be copied)`);
      for (const failure of failures.slice(0, 3)) console.log(`    ${failure}`);
      continue;
    }

    try {
      const mapped = mapMaid(item.src, {
        photoUrls,
        agencyName: agency.name,
        publish: publishFor(args, item.src),
      });
      const data = mapped.data;
      const maid = await createMaidWithAudit({
        agencyId: agency.id,
        data: {
          ...data,
          agencyId: agency.id,
          reference: mapped.reference,
          nationality: (data.nationality as string) ?? "Not stated",
          placementType: (data.placementType as string) ?? "New maid",
          languages: Array.isArray(data.languages) ? data.languages : [],
          duties: Array.isArray(data.duties) ? data.duties : [],
          status: (data.status as "AVAILABLE") ?? "AVAILABLE",
          published: publishFor(args, item.src),
          isSample: false,
          photoUrls,
          photoUrl: photoUrls[0] ?? null,
          photoThumbnailUrls: [],
          photoPortraitUrls: [],
        },
        metadata: {
          sourceProject: sourceProjectRef(),
          sourceAgencyId: args.sourceAgency,
          sourceMaidId: mapped.sourceId,
          reference: mapped.reference,
          photos: photoUrls.length,
        },
      });
      state.maids[mapped.sourceId] = {
        reference: mapped.reference,
        sourceId: mapped.sourceId,
        status: "imported",
        destinationId: maid.id,
        photoUrls,
        attempts: (previous(mapped.sourceId)?.attempts ?? 0) + 1,
        updatedAt: new Date().toISOString(),
      };
      saveState(file, state);
      stats.created += 1;
      console.log(
        `${label} | ${photoUrls.length} photo(s) | created ${maid.id}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      state.maids[item.mapped.sourceId] = {
        reference: item.mapped.reference,
        sourceId: item.mapped.sourceId,
        status: "failed",
        error: message,
        attempts: (previous(item.mapped.sourceId)?.attempts ?? 0) + 1,
        updatedAt: new Date().toISOString(),
      };
      saveState(file, state);
      stats.failed += 1;
      console.log(`${label} | FAILED: ${message}`);
    }
  }

  console.log(
    `\nDone: ${stats.created} created, ${stats.failed} failed | photos ${stats.photosUploaded} uploaded, ${stats.photosReused} reused, ${stats.photosFailed} failed`,
  );
  console.log(
    `State: ${file} - re-run the same command to continue (imported profiles are skipped).`,
  );
  if (stats.failed > 0) process.exitCode = 1;
}
// -------------------------------------------------------------- verification

async function urlAlive(url: string, attempts: number) {
  return withRetry(
    `HEAD ${url}`,
    async () => {
      const response = await fetch(url, { method: "HEAD", cache: "no-store" });
      if (response.ok) return true;
      if (response.status === 405 || response.status === 501) {
        const ranged = await fetch(url, {
          headers: { Range: "bytes=0-0" },
          cache: "no-store",
        });
        return ranged.ok;
      }
      throw new Error(`HTTP ${response.status}`);
    },
    Math.min(2, attempts),
  ).catch(() => false);
}

async function verifyImport(
  agency: { id: string; name: string; slug: string },
  state: MigrationState,
  file: string,
  args: Args,
) {
  const imported = Object.entries(state.maids).filter(
    ([, entry]) => entry.status === "imported",
  );
  if (imported.length === 0)
    throw new Error(`No imported profiles in ${file}. Run an import first.`);

  const ids = imported
    .map(([, entry]) => entry.destinationId)
    .filter(Boolean) as string[];
  const rows = await prisma.maid.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      agencyId: true,
      reference: true,
      published: true,
      photoUrls: true,
    },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const failures: string[] = [];
  type VerifyRecord = {
    reference: string;
    destinationId: string;
    photos: number;
    ok: boolean;
    problem?: string;
    noPhotos?: boolean;
  };
  const results: VerifyRecord[] = [];

  for (const [, entry] of imported) {
    const row = entry.destinationId ? byId.get(entry.destinationId) : undefined;
    const record: VerifyRecord = {
      reference: entry.reference,
      destinationId: entry.destinationId ?? "",
      photos: 0,
      ok: true,
    };
    if (!row) {
      record.ok = false;
      record.problem = `row ${entry.destinationId ?? "(none)"} not found`;
    } else if (row.agencyId !== agency.id) {
      record.ok = false;
      record.problem = `owned by agency ${row.agencyId}, not ${agency.id}`;
    } else {
      const urls = row.photoUrls ?? [];
      record.photos = urls.length;
      if (urls.length === 0) {
        // A source profile without photos is a valid migration result; only an
        // empty row that was expected to carry photos is a failure.
        const expectedPhotos = entry.photoUrls ?? [];
        if (expectedPhotos.length === 0) {
          record.noPhotos = true;
        } else {
          record.ok = false;
          record.problem =
            "photos were recorded for this profile but the row has none";
        }
      } else {
        let dead = 0;
        for (const url of urls)
          if (!(await urlAlive(url, args.retries))) dead += 1;
        if (dead > 0) {
          record.ok = false;
          record.problem = `${dead}/${urls.length} photo URL(s) unreachable`;
        }
      }
    }
    results.push(record);
    if (!record.ok) failures.push(`${record.reference}: ${record.problem}`);
  }

  const passed = results.filter((row) => row.ok).length;
  const failedEntries = Object.entries(state.maids).filter(
    ([, entry]) => entry.status === "failed",
  );
  const skippedEntries = Object.entries(state.maids).filter(
    ([, entry]) => entry.status === "skipped",
  );
  const photos = results.reduce((sum, row) => sum + row.photos, 0);

  console.log(`\n=== Verification: ${agency.name} (${agency.slug}) ===`);
  console.log(
    `profiles  ${passed}/${imported.length} verified (${results.filter((row) => row.noPhotos).length} with no photos in the source) | ${photos} photo URL(s) reachable`,
  );
  console.log(
    `state     ${failedEntries.length} failed, ${skippedEntries.length} skipped recorded earlier`,
  );
  for (const row of results.filter((item) => !item.ok).slice(0, 20))
    console.log(`  FAIL ${row.reference} - ${row.problem}`);
  if (failedEntries.length) {
    console.log(
      "\nFailed attempts still in the state file (fixed by re-running the import):",
    );
    for (const [, entry] of failedEntries.slice(0, 20))
      console.log(`  ${entry.reference} - ${entry.error ?? "unknown error"}`);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const report = path.resolve(
    args.outDir,
    `maid-migration-verify-${agency.slug}-${stamp}.json`,
  );
  mkdirSync(path.resolve(args.outDir), { recursive: true });
  writeFileSync(
    report,
    `${JSON.stringify(
      {
        kind: "findmaids-maid-migration-verify",
        createdAt: new Date().toISOString(),
        agency: { id: agency.id, slug: agency.slug, name: agency.name },
        totals: {
          imported: imported.length,
          verified: passed,
          failed: failures.length,
          withoutPhotos: results.filter((row) => row.noPhotos).length,
          photos,
        },
        results,
        failures,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.log(`\nVerification report: ${report}`);
  if (failures.length > 0) process.exitCode = 1;
}
// ----------------------------------------------------------------------- main

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return usage();

  requireSourceConfig();
  const destination = requireDestinationConfig();
  const destinationProject = new URL(destination.url).hostname.split(".")[0];

  const { maids, blobKeys } = await loadSourceMaids(args.retries);
  const inScope = maids.filter(
    (maid) => scalar(maid.agencyId) === args.sourceAgency,
  );
  const referenceCount = new Set(
    inScope.map((maid) => text(maid.referenceCode)),
  ).size;

  // Step 0: choose the destination agency. Nothing is guessed.
  if (!args.toAgency) {
    console.log(
      `Source      ${sourceProjectRef()} | ${sourceTable}.data.maids (id=${sourceRowId}) | bucket ${sourceBucket}`,
    );
    console.log(
      `Profiles    ${maids.length} total | ${inScope.length} in source agency ${args.sourceAgency} | ${referenceCount} unique reference(s)`,
    );
    console.log(`Blob keys   ${blobKeys.join(", ")}`);
    const agencies = await destinationAgencies();
    console.log(
      `\nDestination ${destinationProject} | media bucket ${destination.bucket}`,
    );
    console.log(
      `\n${"slug".padEnd(30)}${"maids".padStart(6)}${"public".padStart(8)}  name`,
    );
    for (const agency of agencies)
      console.log(
        `${agency.slug.padEnd(30)}${String(agency.maids).padStart(6)}${String(agency.published).padStart(8)}  ${agency.name}`,
      );
    console.log("\nChoose one explicitly, then run the dry run:");
    console.log("  npm run maids:migrate -- --to-agency=<slug> --dry-run");
    return;
  }

  const agency = await resolveAgency(args.toAgency);
  const agencyRow = (await destinationAgencies()).find(
    (row) => row.id === agency.id,
  );
  const agencyCounts = {
    maids: agencyRow?.maids ?? 0,
    published: agencyRow?.published ?? 0,
  };
  const file = stateFile(args, agency.slug);
  const state = loadState(file, {
    agencyId: agency.id,
    agencySlug: agency.slug,
    project: destinationProject,
    bucket: destination.bucket,
    sourceProject: sourceProjectRef(),
  });

  if (args.verify) return verifyImport(agency, state, file, args);

  console.log(`\nScanning ${sourceBucket}/maids/ (read-only) ...`);
  const index = await discoverPhotoIndex(args.retries, true);
  const items = await buildPlan({ args, maids, index, agency, state });
  const bag: ReportBag = {
    args,
    agency,
    agencyCounts,
    destination: { project: destinationProject, bucket: destination.bucket },
    source: { total: maids.length, inScope: inScope.length, blobKeys },
    index,
    items,
  };
  const summary = printRunReport(bag);
  printDecisions(bag, summary);
  writePlanReport(bag);

  if (args.dryRun) {
    console.log(
      "\nDry run only: nothing was uploaded and nothing was written to the database.",
    );
    console.log("\nNext: test-import 3 profiles, then verify them:");
    console.log(
      `  npm run maids:migrate -- --to-agency=${agency.slug} --limit 3 --confirm=${agency.slug}`,
    );
    console.log(
      `  npm run maids:migrate -- --to-agency=${agency.slug} --verify`,
    );
    return;
  }

  if (args.confirm !== agency.slug)
    throw new Error(
      `Refusing to write without --confirm=${agency.slug} (the resolved destination agency).`,
    );

  if (
    !args.allowOverLimit &&
    agencyCounts.maids + summary.importable.length > AGENCY_MAID_LIMIT
  )
    throw new Error(
      `This batch would take ${agency.slug} to ${agencyCounts.maids + summary.importable.length} profiles, above the ${AGENCY_MAID_LIMIT} cap. Split the batch or pass --allow-over-limit.`,
    );

  await runImport({ args, agency, items, state, file });
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Maid migration failed.",
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
// @@CHUNK8@@
