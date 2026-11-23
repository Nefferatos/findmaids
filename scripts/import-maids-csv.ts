/**
 * Imports maid rows from the agency CSV export into an agency's profile list.
 *
 * Usage:
 *   npx tsx scripts/import-maids-csv.ts --file maids_rows.csv \
 *     --agency agency2026@findmaids.test [--limit 5] [--references A,B] \
 *     [--keep-photos] [--photos-dir /path/to/old/uploads] [--dry-run]
 *
 * `--keep-photos` copies the CSV's `photo_data_url(s)` arrays. Those are legacy
 * `/uploads/...` paths, so pass `--photos-dir` pointing at the old portal's
 * uploads folder to re-host them in Supabase Storage and store public URLs
 * instead. Files are matched on their basename (e.g. photo-1-1100e725….jpg).
 *
 * The CSV columns are the ones produced by the old agency portal:
 *   full_name, reference_code, type, nationality, date_of_birth, place_of_birth,
 *   height, weight, religion, marital_status, number_of_children,
 *   number_of_siblings, home_address, airport_repatriation, education_level,
 *   language_skills, skills_preferences, work_areas, employment_history,
 *   introduction, agency_contact, is_public, status, photo_data_url(s), video_data_url
 *
 * Re-running is safe: rows are upserted on (agencyId, reference).
 */
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "../lib/prisma-script";
import { storeObject } from "../lib/storage";
import {
  emptyAgencyContact,
  emptyLanguageSkills,
  emptyMedical,
  emptyPreferences,
  emptyWorkAreas,
  readAgencyContact,
  readEmploymentHistory,
  readLanguageSkills,
  readMedical,
  readPreferences,
  readWorkAreas,
} from "../lib/maid-profile";

type Args = {
  file: string;
  agency: string;
  limit?: number;
  references?: string[];
  keepPhotos: boolean;
  photosDir?: string;
  publish: boolean;
  dryRun: boolean;
};

function parseArgs(argv: string[]): Args {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      values.set(key, next);
      index += 1;
    } else {
      flags.add(key);
    }
  }
  const file = values.get("file");
  const agency = values.get("agency");
  if (!file || !agency) {
    throw new Error(
      "Usage: --file <csv> --agency <owner email or slug> [--limit N] [--references A,B] [--keep-photos] [--photos-dir <folder>] [--dry-run]",
    );
  }
  const photosDir = values.get("photos-dir");
  return {
    file,
    agency,
    limit: values.get("limit") ? Number(values.get("limit")) : undefined,
    references: values
      .get("references")
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    // A photos folder implies the CSV photo arrays are wanted.
    keepPhotos: flags.has("keep-photos") || Boolean(photosDir),
    photosDir,
    publish: flags.has("publish"),
    dryRun: flags.has("dry-run"),
  };
}

/** Minimal RFC 4180 parser: quotes, escaped quotes, CRLF and embedded newlines. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  }
  return rows;
}

const text = (value: string | undefined) => {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
};

const count = (value: string | undefined) => {
  const number = Number((value ?? "").trim());
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
};

const level = (value: string | undefined) => {
  const trimmed = (value ?? "").trim();
  if (!trimmed || trimmed === "0") return null;
  return trimmed;
};

function json<T>(
  value: string | undefined,
  reader: (raw: unknown) => T,
  empty: T,
) {
  const raw = (value ?? "").trim();
  if (!raw || raw === "{}" || raw === "[]") return empty;
  try {
    return reader(JSON.parse(raw));
  } catch {
    return empty;
  }
}

function salaryFromIntro(intro: string | null) {
  if (!intro) return null;
  const match = /\$\s?(\d{3,4})/.exec(intro);
  return match ? Number(match[1]) : null;
}

function money(value: unknown) {
  if (typeof value === "number") return Math.round(value);
  if (typeof value !== "string") return null;
  const match = /\d{3,5}/.exec(value);
  return match ? Number(match[0]) : null;
}

const STATUS: Record<string, "AVAILABLE" | "ON_HOLD" | "PLACED"> = {
  available: "AVAILABLE",
  reserved: "ON_HOLD",
  placed: "PLACED",
};

const PHOTO_FORMATS = new Set(["jpeg", "png", "webp"]);

/** Legacy photo path → lower-cased file name used to match files on disk. */
function legacyPhotoName(url: string) {
  const clean = url.split(/[?#]/)[0];
  const name = clean.split("/").pop() ?? "";
  try {
    return decodeURIComponent(name).toLowerCase();
  } catch {
    return name.toLowerCase();
  }
}

/** Recursively maps lower-cased file basenames to their absolute paths. */
function indexPhotoFiles(root: string) {
  const index = new Map<string, string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        const key = entry.name.toLowerCase();
        if (!index.has(key)) index.set(key, full);
      }
    }
  };
  walk(root);
  return index;
}

/**
 * Re-hosts one legacy photo in Supabase Storage using the same processing the
 * agency media route applies (max 800px, WebP), then returns its public URL.
 */
async function uploadMaidPhoto(filePath: string, reference: string) {
  const image = sharp(readFileSync(filePath), {
    limitInputPixels: 40_000_000,
    failOn: "error",
  });
  const metadata = await image.metadata();
  if (!metadata.format || !PHOTO_FORMATS.has(metadata.format))
    throw new Error("not a JPG, PNG, or WebP image");
  const output = await image
    .rotate()
    .resize({
      width: 800,
      height: 800,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
  const slug = reference
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-");
  return storeObject({
    bucket: "media",
    key: `maids/${slug || "unknown"}/${randomUUID()}.webp`,
    body: output,
    contentType: "image/webp",
    public: true,
  });
}

type PhotoResolution = {
  urls: string[];
  uploaded: number;
  ready: number;
  missing: number;
  failures: string[];
};

/** Uploads every photo that can be found locally; keeps legacy paths otherwise. */
async function resolveMaidPhotos(
  urls: string[],
  reference: string,
  index: Map<string, string>,
  dryRun: boolean,
): Promise<PhotoResolution> {
  const result: PhotoResolution = {
    urls: [],
    uploaded: 0,
    ready: 0,
    missing: 0,
    failures: [],
  };
  for (const url of urls) {
    const file = index.get(legacyPhotoName(url));
    if (!file) {
      result.urls.push(url);
      result.missing += 1;
      continue;
    }
    if (dryRun) {
      result.urls.push(url);
      result.ready += 1;
      continue;
    }
    try {
      result.urls.push(await uploadMaidPhoto(file, reference));
      result.uploaded += 1;
    } catch (error) {
      result.urls.push(url);
      result.missing += 1;
      result.failures.push(
        `${reference} ${path.basename(file)}: ${
          error instanceof Error ? error.message : "upload failed"
        }`,
      );
    }
  }
  return result;
}

function buildMaid(row: Record<string, string>, keepPhotos: boolean) {
  const intro = json(
    row.introduction,
    (raw) => {
      const source = (raw ?? {}) as Record<string, unknown>;
      return {
        publicIntro:
          text(source.publicIntro as string) ?? text(source.intro as string),
        availability: text(source.availability as string),
        contractEnds: text(source.contractEnds as string),
        expectedSalary: money(source.expectedSalary),
        presentSalary: money(source.presentSalary),
        offDaysPerMonth: count(source.offDaysPerMonth as string),
        foodHandlingPreferences: text(source.foodHandlingPreferences as string),
        dietaryRestrictions: text(source.dietaryRestrictions as string),
        medical: readMedical(source),
      };
    },
    {
      publicIntro: null,
      availability: null,
      contractEnds: null,
      expectedSalary: null,
      presentSalary: null,
      offDaysPerMonth: null,
      foodHandlingPreferences: null,
      dietaryRestrictions: null,
      medical: emptyMedical(),
    },
  );

  const languageSkills = json(
    row.language_skills,
    readLanguageSkills,
    emptyLanguageSkills(),
  );
  const preferences = json(
    row.skills_preferences,
    readPreferences,
    emptyPreferences(),
  );
  const workAreas = json(row.work_areas, readWorkAreas, emptyWorkAreas());
  const employment = json(row.employment_history, readEmploymentHistory, []);
  const agencyContact = json(
    row.agency_contact,
    readAgencyContact,
    emptyAgencyContact(),
  );

  const languages = Object.entries(languageSkills)
    .filter(([, proficiency]) => proficiency && proficiency !== "Zero")
    .map(([language]) => language);
  const duties = Object.entries(workAreas)
    .filter(([area]) => area !== "Language abilities (spoken)")
    .filter(([, area]) => (area.rating ?? 0) >= 3 || area.experience)
    .map(([area]) => area);

  const dateOfBirth = text(row.date_of_birth)
    ? new Date(`${row.date_of_birth.trim()}T00:00:00.000Z`)
    : null;
  const photos = keepPhotos
    ? json<string[]>(
        row.photo_data_urls,
        (raw) =>
          Array.isArray(raw)
            ? raw.filter((item): item is string => typeof item === "string")
            : [],
        [],
      )
    : [];

  return {
    reference: text(row.reference_code) ?? "",
    fullName: text(row.full_name),
    nationality: text(row.nationality) ?? "Not stated",
    placementType: text(row.type) ?? "New maid",
    dateOfBirth:
      dateOfBirth && !Number.isNaN(dateOfBirth.getTime()) ? dateOfBirth : null,
    placeOfBirth: text(row.place_of_birth),
    heightCm: level(row.height) ? Number(level(row.height)) : null,
    weightKg: level(row.weight) ? Number(level(row.weight)) : null,
    religion: text(row.religion),
    maritalStatus: text(row.marital_status),
    childrenCount: count(row.number_of_children) ?? 0,
    siblingsCount: count(row.number_of_siblings) ?? 0,
    homeAddress: text(row.home_address),
    airportRepatriation: text(row.airport_repatriation),
    educationLevel: text(row.education_level),
    languages,
    duties,
    experienceYears: null,
    monthlySalary: salaryFromIntro(intro.publicIntro),
    expectedSalary: intro.expectedSalary,
    presentSalary: intro.presentSalary,
    status: STATUS[(row.status ?? "").trim().toLowerCase()] ?? "AVAILABLE",
    published: (row.is_public ?? "").trim() === "true",
    availability: intro.availability ?? preferences.availabilityRemark ?? null,
    contractEnds: intro.contractEnds,
    offDaysPerMonth:
      intro.offDaysPerMonth ??
      (preferences.offDaysPerMonth ? count(preferences.offDaysPerMonth) : null),
    foodHandlingPreferences: intro.foodHandlingPreferences,
    dietaryRestrictions: intro.dietaryRestrictions,
    introduction: intro.publicIntro,
    languageSkills,
    preferences,
    workAreas,
    employmentHistory: employment,
    medicalInfo: intro.medical,
    agencyContact,
    photoUrl: photos[0] ?? null,
    photoUrls: photos,
    videoUrl: keepPhotos ? text(row.video_data_url) : null,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const csv = readFileSync(args.file, "utf8");
  const rows = parseCsv(csv);
  if (rows.length < 2) throw new Error("The CSV has no data rows.");
  const header = rows[0].map((cell) => cell.trim());
  const records = rows.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    header.forEach((column, index) => {
      record[column] = cells[index] ?? "";
    });
    return record;
  });

  const user = await prisma.user.findFirst({
    where: { email: args.agency.trim().toLowerCase() },
    select: { id: true, email: true },
  });
  const agency = user
    ? await prisma.agency.findFirst({
        where: { ownerId: user.id },
        select: { id: true, name: true, slug: true },
      })
    : await prisma.agency.findFirst({
        where: { slug: args.agency.trim() },
        select: { id: true, name: true, slug: true },
      });
  if (!agency) {
    throw new Error(
      `No agency found for "${args.agency}". Pass the owner's login email or the agency slug.`,
    );
  }
  console.log(`Agency: ${agency.name} (${agency.slug})`);

  let selected = records.filter((row) => (row.reference_code ?? "").trim());
  if (args.references?.length) {
    const wanted = new Set(args.references);
    selected = selected.filter((row) => wanted.has(row.reference_code.trim()));
  }
  selected = selected.filter((row) => (row.full_name ?? "").trim());
  if (args.limit && args.limit > 0) selected = selected.slice(0, args.limit);

  let photoIndex: Map<string, string> | null = null;
  if (args.photosDir) {
    try {
      photoIndex = indexPhotoFiles(args.photosDir);
    } catch {
      throw new Error(`Cannot read --photos-dir "${args.photosDir}".`);
    }
    if (photoIndex.size === 0)
      throw new Error(`--photos-dir "${args.photosDir}" contains no files.`);
  }

  let created = 0;
  let updated = 0;
  let photosUploaded = 0;
  let photosReady = 0;
  let photosMissing = 0;
  let photosOnLegacyPath = 0;
  const photoFailures: string[] = [];
  for (const row of selected) {
    const data = buildMaid(row, args.keepPhotos);
    if (args.publish) data.published = true;

    let photoNote = "";
    if (data.photoUrls.length > 0) {
      if (photoIndex) {
        const resolved = await resolveMaidPhotos(
          data.photoUrls,
          data.reference,
          photoIndex,
          args.dryRun,
        );
        data.photoUrls = resolved.urls;
        data.photoUrl = resolved.urls[0] ?? null;
        photosUploaded += resolved.uploaded;
        photosReady += resolved.ready;
        photosMissing += resolved.missing;
        photoFailures.push(...resolved.failures);
        photoNote = ` | photos=${resolved.urls.length}`;
        if (args.dryRun)
          photoNote += ` (${resolved.ready} ready, ${resolved.missing} missing)`;
      } else {
        photosOnLegacyPath += data.photoUrls.length;
        photoNote = ` | photos=${data.photoUrls.length} (legacy paths)`;
      }
    }

    if (args.dryRun) {
      console.log(
        `[dry-run] ${data.reference} | ${data.fullName} | ${data.nationality} | ${data.placementType} | published=${data.published} | $${data.monthlySalary ?? "-"}${photoNote}`,
      );
      continue;
    }
    const existing = await prisma.maid.findFirst({
      where: { agencyId: agency.id, reference: data.reference },
      select: { id: true },
    });
    if (existing) {
      await prisma.maid.update({ where: { id: existing.id }, data });
      updated += 1;
      console.log(`updated ${data.reference} (${data.fullName})${photoNote}`);
    } else {
      await prisma.maid.create({ data: { ...data, agencyId: agency.id } });
      created += 1;
      console.log(`created ${data.reference} (${data.fullName})${photoNote}`);
    }
  }

  if (photosUploaded > 0 || photosReady > 0 || photosMissing > 0)
    console.log(
      `\nPhotos: ${photosUploaded} uploaded, ${photosReady} ready (dry run), ${photosMissing} kept on their legacy path.`,
    );
  else if (photosOnLegacyPath > 0)
    console.log(
      `\nPhotos: ${photosOnLegacyPath} saved as legacy /uploads paths. Pass --photos-dir <folder> with the old portal's uploads to re-host them in Supabase Storage.`,
    );
  for (const failure of photoFailures.slice(0, 10))
    console.warn(`photo skipped: ${failure}`);

  const total = await prisma.maid.count({ where: { agencyId: agency.id } });
  const published = await prisma.maid.count({
    where: { agencyId: agency.id, published: true },
  });
  console.log(
    `\nDone: ${created} created, ${updated} updated. Agency now has ${total} maids (${published} public).`,
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
