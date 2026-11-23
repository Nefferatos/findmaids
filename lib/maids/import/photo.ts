import sharp from "sharp";
import {
  detectDocumentType,
  loadPdfDocument,
} from "@/lib/maids/import/document";
import { MaidImportError } from "@/lib/maids/import/types";

/**
 * A photo lifted out of an uploaded biodata document, already normalised to
 * WebP. Nothing is persisted here: the import route uploads it.
 */
export type ExtractedPhoto = {
  bytes: Uint8Array;
  width: number;
  height: number;
  contentType: "image/webp";
  source: "pdf" | "docx";
};

type RawImage = {
  width: number;
  height: number;
  channels: number;
  data: Uint8Array | Uint8ClampedArray;
};

/** Below these sizes an image is an icon, checkbox or logo, not a portrait. */
const MIN_SHORT_EDGE = 160;
const MIN_LONG_EDGE = 220;
const MIN_AREA = 50_000;
/** Wider than this is a banner/logo; narrower is a divider or sliver. */
const MIN_ASPECT = 0.55;
const MAX_ASPECT = 1.4;
/** White, low-saturation images are page scans or form backgrounds. */
const MIN_COLOUR_RATIO = 0.14;
const MAX_WHITE_RATIO = 0.8;
const MAX_PAGES = 12;
const MAX_PDF_IMAGES = 40;
const MAX_DOCX_IMAGES = 12;
const MAX_INPUT_PIXELS = 24_000_000;
const SAMPLE_PIXELS = 6_000;

/**
 * Scores a raw bitmap as a portrait-photo candidate, or returns `null` when it
 * cannot be the FDW photo (too small, wrong shape, monochrome or a scan).
 */
export function scorePhotoCandidate(raw: RawImage): number | null {
  const { width, height, channels, data } = raw;
  if (!Number.isInteger(width) || !Number.isInteger(height)) return null;
  if (width <= 0 || height <= 0) return null;
  if (channels !== 1 && channels !== 3 && channels !== 4) return null;
  if (Math.min(width, height) < MIN_SHORT_EDGE) return null;
  if (Math.max(width, height) < MIN_LONG_EDGE) return null;
  if (width * height < MIN_AREA) return null;

  const aspect = width / height;
  if (aspect < MIN_ASPECT || aspect > MAX_ASPECT) return null;
  if (data.length < width * height * channels) return null;

  const pixels = width * height;
  const step = Math.max(1, Math.floor(pixels / SAMPLE_PIXELS));
  let sampled = 0;
  let colourful = 0;
  let white = 0;
  for (let pixel = 0; pixel < pixels; pixel += step) {
    const offset = pixel * channels;
    const r = data[offset];
    const g = channels === 1 ? r : data[offset + 1];
    const b = channels === 1 ? r : data[offset + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    sampled += 1;
    if (max - min >= 36) colourful += 1;
    if (min >= 232) white += 1;
  }
  if (sampled === 0) return null;

  const colourRatio = colourful / sampled;
  const whiteRatio = white / sampled;
  if (colourRatio < MIN_COLOUR_RATIO) return null;
  if (whiteRatio > MAX_WHITE_RATIO) return null;

  // Prefer large, colourful, fully framed images.
  return Math.round(
    width * height * (0.5 + colourRatio) * (1 - whiteRatio * 0.5),
  );
}

function toRawImage(value: unknown): RawImage | null {
  if (!value || typeof value !== "object") return null;
  const image = value as {
    width?: unknown;
    height?: unknown;
    data?: unknown;
  };
  if (typeof image.width !== "number" || typeof image.height !== "number")
    return null;
  if (
    !(image.data instanceof Uint8Array) &&
    !(image.data instanceof Uint8ClampedArray)
  )
    return null;
  const { width, height, data } = image;
  if (width <= 0 || height <= 0 || width * height === 0) return null;
  const channels = data.length / (width * height);
  if (!Number.isInteger(channels)) return null;
  return { width, height, channels, data };
}

/** Resolves a pdf.js image object that may be decoded asynchronously. */
function readPdfImage(
  page: {
    objs: { get: (id: string, callback?: (data: unknown) => void) => unknown };
  },
  name: string,
): Promise<RawImage | null> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => finish(null), 2_000);
    function finish(value: RawImage | null) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    }
    try {
      const immediate = page.objs.get(name, (image) =>
        finish(toRawImage(image)),
      );
      if (immediate) finish(toRawImage(immediate));
    } catch {
      finish(null);
    }
  });
}

async function pdfPhotoCandidates(bytes: Uint8Array): Promise<RawImage[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await loadPdfDocument(bytes);
  const candidates: RawImage[] = [];

  try {
    const pageCount = Math.min(document.numPages, MAX_PAGES);
    for (
      let pageNumber = 1;
      pageNumber <= pageCount && candidates.length < MAX_PDF_IMAGES;
      pageNumber += 1
    ) {
      const page = await document.getPage(pageNumber);
      const ops = await page.getOperatorList();
      const names: string[] = [];
      for (
        let index = 0;
        index < ops.fnArray.length &&
        candidates.length + names.length < MAX_PDF_IMAGES;
        index += 1
      ) {
        const fn = ops.fnArray[index];
        const args = ops.argsArray[index];
        if (fn === pdfjs.OPS.paintInlineImageXObject) {
          const raw = toRawImage(args?.[0]);
          if (raw && raw.width * raw.height <= MAX_INPUT_PIXELS)
            candidates.push(raw);
          continue;
        }
        if (fn !== pdfjs.OPS.paintImageXObject) continue;
        const name = args?.[0];
        if (typeof name === "string") names.push(name);
      }
      // Resolve the page's images together so one slow decode cannot block.
      const resolved = await Promise.all(
        names.map((name) => readPdfImage(page, name)),
      );
      for (const raw of resolved)
        if (raw && raw.width * raw.height <= MAX_INPUT_PIXELS)
          candidates.push(raw);
      page.cleanup();
    }
  } finally {
    await document.destroy().catch(() => undefined);
  }

  return candidates;
}

async function docxPhotoCandidates(bytes: Uint8Array): Promise<RawImage[]> {
  let mammoth: typeof import("mammoth");
  try {
    mammoth = await import("mammoth");
  } catch {
    throw new MaidImportError(
      "Word support is unavailable on this server. Please upload a PDF.",
      { status: 503, code: "docx_unavailable" },
    );
  }

  const images: Buffer[] = [];
  try {
    await mammoth.convertToHtml(
      { buffer: Buffer.from(bytes) },
      {
        convertImage: mammoth.images.imgElement(async (image) => {
          if (images.length < MAX_DOCX_IMAGES)
            images.push(Buffer.from(await image.read()));
          return { src: "" };
        }),
      },
    );
  } catch {
    throw new MaidImportError(
      "That Word document could not be read. It may be corrupted.",
      { code: "corrupt_docx" },
    );
  }

  const candidates: RawImage[] = [];
  for (const image of images) {
    try {
      const { data, info } = await sharp(image, {
        limitInputPixels: MAX_INPUT_PIXELS,
      })
        .raw()
        .toBuffer({ resolveWithObject: true });
      if (info.width * info.height <= MAX_INPUT_PIXELS)
        candidates.push({
          width: info.width,
          height: info.height,
          channels: info.channels,
          data,
        });
    } catch {
      // Skip images sharp cannot decode.
    }
  }
  return candidates;
}

async function encodePhoto(
  raw: RawImage,
  source: "pdf" | "docx",
): Promise<ExtractedPhoto | null> {
  try {
    const { data, info } = await sharp(Buffer.from(raw.data), {
      raw: {
        width: raw.width,
        height: raw.height,
        channels: raw.channels as 1 | 2 | 3 | 4,
      },
      limitInputPixels: MAX_INPUT_PIXELS,
    })
      .resize({
        width: 1200,
        height: 1200,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 84, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    return {
      bytes: new Uint8Array(data),
      width: info.width,
      height: info.height,
      contentType: "image/webp",
      source,
    };
  } catch {
    return null;
  }
}

/**
 * Finds the most photo-like embedded image in a PDF/DOCX biodata document and
 * returns it as a WebP. Returns `null` when the document has no usable photo.
 */
export async function extractDocumentPhoto(input: {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
}): Promise<ExtractedPhoto | null> {
  const source = detectDocumentType(input);
  const candidates =
    source === "pdf"
      ? await pdfPhotoCandidates(input.bytes)
      : await docxPhotoCandidates(input.bytes);

  let best: { score: number; raw: RawImage } | null = null;
  for (const raw of candidates) {
    const score = scorePhotoCandidate(raw);
    if (score === null) continue;
    if (!best || score > best.score) best = { score, raw };
  }
  if (!best) return null;
  return encodePhoto(best.raw, source);
}
