import { findPortraitRegion } from "@/lib/maids/import/portrait";
import { cleanOcrText } from "@/lib/maids/import/ocr-text";

/**
 * On-device PDF OCR. The browser renders each page with pdf.js and reads it
 * with Tesseract (WASM). Running it here works on Cloudflare Workers hosting,
 * where the server has no canvas and cannot run native OCR. The PDF never
 * leaves the device; only the recognized text is sent back for field mapping.
 */

export type PdfOcrProgress = (stage: string) => void;

export type PdfOcrResult = {
  text: string;
  pages: number;
  portrait: Blob | null;
};

export class PdfOcrError extends Error {
  readonly code: "render_failed" | "ocr_unavailable" | "empty";

  constructor(message: string, code: PdfOcrError["code"]) {
    super(message);
    this.name = "PdfOcrError";
    this.code = code;
  }
}

const MAX_PAGES = 5;
const MAX_RENDER_EDGE = 2200;
const PREVIEW_WIDTH = 320;

let pdfWorkerConfigured = false;

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfWorkerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    pdfWorkerConfigured = true;
  }
  return pdfjs;
}

function drawCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d");
  if (!context)
    throw new PdfOcrError("The page could not be rendered.", "render_failed");
  return { canvas, context };
}

function previewOf(canvas: HTMLCanvasElement) {
  const scale = Math.min(1, PREVIEW_WIDTH / canvas.width);
  const { canvas: small, context } = drawCanvas(
    canvas.width * scale,
    canvas.height * scale,
  );
  context.drawImage(canvas, 0, 0, small.width, small.height);
  return { canvas: small, scale, context };
}

function canvasBlob(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob((blob) => resolve(blob), type, 0.9),
  );
}

async function cropPortrait(
  canvas: HTMLCanvasElement,
  region: { x: number; y: number; width: number; height: number },
  previewScale: number,
) {
  const margin = 0.03;
  const left = Math.max(0, (region.x - region.width * margin) / previewScale);
  const top = Math.max(0, (region.y - region.height * margin) / previewScale);
  const width = Math.min(
    canvas.width - left,
    (region.width * (1 + margin * 2)) / previewScale,
  );
  const height = Math.min(
    canvas.height - top,
    (region.height * (1 + margin * 2)) / previewScale,
  );
  if (width < 80 || height < 100) return null;
  const { canvas: out, context } = drawCanvas(width, height);
  context.drawImage(
    canvas,
    left,
    top,
    width,
    height,
    0,
    0,
    out.width,
    out.height,
  );
  return (
    (await canvasBlob(out, "image/webp")) ??
    (await canvasBlob(out, "image/png"))
  );
}

export async function ocrPdf(
  file: File,
  options: {
    pages?: number[];
    maxPages?: number;
    onProgress?: PdfOcrProgress;
  } = {},
): Promise<PdfOcrResult> {
  const onProgress = options.onProgress ?? (() => {});
  const pageLimit = Math.max(
    1,
    Math.min(options.maxPages ?? MAX_PAGES, MAX_PAGES),
  );

  onProgress("Reading PDF…");
  const pdfjs = await loadPdfjs();
  let document;
  try {
    document = await pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
    }).promise;
  } catch {
    throw new PdfOcrError(
      "That PDF could not be opened for OCR. It may be corrupted or password protected.",
      "render_failed",
    );
  }

  let worker: Awaited<
    ReturnType<(typeof import("tesseract.js"))["createWorker"]>
  > | null = null;
  try {
    const wanted = (
      options.pages?.length
        ? options.pages
        : Array.from(
            { length: Math.min(document.numPages, pageLimit) },
            (_, index) => index + 1,
          )
    )
      .filter((page) => page >= 1 && page <= document.numPages)
      .slice(0, pageLimit);
    if (wanted.length === 0)
      throw new PdfOcrError("No pages could be read from this PDF.", "empty");

    const tesseract = await import("tesseract.js");
    onProgress("Loading OCR engine…");
    let currentPage = 0;
    try {
      worker = await tesseract.createWorker("eng", 1, {
        logger: (message) => {
          if (message.status !== "recognizing text") return;
          const percent =
            typeof message.progress === "number"
              ? ` ${Math.round(message.progress * 100)}%`
              : "";
          onProgress(
            `Recognising text (page ${currentPage} of ${wanted.length})…${percent}`,
          );
        },
      });
    } catch {
      throw new PdfOcrError(
        "The OCR engine could not be loaded. Check your connection and try again.",
        "ocr_unavailable",
      );
    }

    const texts: string[] = [];
    let portrait: {
      canvas: HTMLCanvasElement;
      region: NonNullable<ReturnType<typeof findPortraitRegion>>;
      scale: number;
      score: number;
    } | null = null;

    for (let index = 0; index < wanted.length; index += 1) {
      const pageNumber = wanted[index];
      onProgress(`Rendering page ${index + 1} of ${wanted.length}…`);
      const page = await document.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(
        2,
        MAX_RENDER_EDGE / Math.max(base.width, base.height),
      );
      const viewport = page.getViewport({ scale });
      const { canvas, context } = drawCanvas(viewport.width, viewport.height);
      try {
        await page.render({ canvasContext: context, viewport }).promise;
      } catch {
        throw new PdfOcrError(
          "The scanned pages could not be rendered.",
          "render_failed",
        );
      }

      currentPage = index + 1;
      onProgress(`Recognising text (page ${currentPage} of ${wanted.length})…`);
      const { data } = await worker.recognize(canvas);
      if (data.text.trim()) texts.push(data.text.trim());

      const preview = previewOf(canvas);
      const image = preview.context.getImageData(
        0,
        0,
        preview.canvas.width,
        preview.canvas.height,
      );
      const region = findPortraitRegion({
        width: image.width,
        height: image.height,
        data: image.data,
      });
      if (region && (!portrait || region.score > portrait.score))
        portrait = {
          canvas,
          region,
          scale: preview.scale,
          score: region.score,
        };
    }

    let portraitBlob: Blob | null = null;
    if (portrait) {
      onProgress("Extracting portrait…");
      portraitBlob = await cropPortrait(
        portrait.canvas,
        portrait.region,
        portrait.scale,
      );
    }

    return {
      text: cleanOcrText(texts.join("\n\n")),
      pages: wanted.length,
      portrait: portraitBlob,
    };
  } finally {
    await worker?.terminate().catch(() => undefined);
    await document.destroy().catch(() => undefined);
  }
}
