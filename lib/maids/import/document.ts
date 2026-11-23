import {
  MAID_IMPORT_MAX_BYTES,
  MaidImportError,
  type ExtractedDocument,
  type MaidImportSource,
} from "@/lib/maids/import/types";

/** Characters kept for rule parsing; the AI prompt is trimmed further. */
const RULE_TEXT_LIMIT = 200_000;
/** Hard page cap for server-side text extraction (uploads are ≤ 8 MB). */
const MAX_TEXT_PAGES = 30;

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((value, index) => bytes[offset + index] === value);

const decoder = new TextDecoder("latin1");
const printable = (bytes: Uint8Array) => decoder.decode(bytes);

/**
 * Identifies a PDF/DOCX from its bytes (never the file name alone) and rejects
 * anything whose extension, MIME type and magic bytes disagree.
 */
export function detectDocumentType(input: {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
}): MaidImportSource {
  const { bytes, fileName } = input;
  const mimeType = input.mimeType.toLowerCase();
  const extension = fileName.toLowerCase().split(".").pop() ?? "";

  if (bytes.byteLength === 0)
    throw new MaidImportError("The uploaded file is empty.", {
      code: "empty_file",
    });
  if (bytes.byteLength > MAID_IMPORT_MAX_BYTES)
    throw new MaidImportError(
      "That file is larger than 8 MB. Please upload a smaller document.",
      { status: 413, code: "file_too_large" },
    );

  const isPdf = printable(bytes.slice(0, 5)) === "%PDF-";
  // ZIP local file header; a DOCX is a ZIP whose central directory names word/…
  const isZip =
    startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWith(bytes, [0x50, 0x4b, 0x05, 0x06]);

  if (isPdf) {
    if (extension !== "pdf" && extension !== "")
      throw new MaidImportError(
        "The file name does not match its contents. Please upload a .pdf file.",
        { code: "type_mismatch" },
      );
    return "pdf";
  }

  if (isZip) {
    const directory = printable(
      bytes.slice(Math.max(0, bytes.byteLength - 65_536)),
    );
    if (!directory.includes("word/document.xml"))
      throw new MaidImportError("That ZIP file is not a Word .docx document.", {
        code: "not_docx",
      });
    if (extension !== "docx" && extension !== "")
      throw new MaidImportError(
        "The file name does not match its contents. Please upload a .docx file.",
        { code: "type_mismatch" },
      );
    return "docx";
  }

  throw new MaidImportError(
    mimeType === "application/pdf" || extension === "pdf"
      ? "That PDF could not be read. It may be corrupted."
      : "Upload a PDF or Word (.docx) biodata file.",
    { code: "unsupported_type" },
  );
}

function normaliseText(raw: string) {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Loads a PDF with the bundled pdf.js worker. Shared by the text and photo
 * extractors so both use the same parser configuration.
 */
export async function loadPdfDocument(bytes: Uint8Array) {
  let pdfjs: typeof import("pdfjs-dist/legacy/build/pdf.mjs");
  try {
    pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  } catch {
    throw new MaidImportError(
      "PDF support is unavailable on this server. Please upload a .docx file.",
      { status: 503, code: "pdf_unavailable" },
    );
  }

  // pdf.js runs its parser in a worker. When bundled, its default relative
  // worker path points inside .next, so resolve the real file explicitly.
  try {
    const [{ pathToFileURL }, path] = await Promise.all([
      import("node:url"),
      import("node:path"),
    ]);
    const worker = path.join(
      process.cwd(),
      "node_modules",
      "pdfjs-dist",
      "legacy",
      "build",
      "pdf.worker.mjs",
    );
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(worker).href;
  } catch {
    // Fall back to pdf.js's own resolution; extraction still works when the
    // worker file sits beside the bundle.
  }

  let document;
  try {
    document = await pdfjs.getDocument({
      // pdf.js transfers the buffer to its worker; keep the caller's bytes.
      data: bytes.slice(),
      useSystemFonts: false,
      isEvalSupported: false,
      disableFontFace: true,
      useWorkerFetch: false,
    }).promise;
  } catch (error) {
    console.error("[maid-import] pdf parse failed", {
      message:
        error instanceof Error
          ? `${error.name}: ${error.message}`.slice(0, 300)
          : "unknown",
    });
    throw new MaidImportError(
      "That PDF could not be read. It may be corrupted or password protected.",
      { code: "corrupt_pdf" },
    );
  }

  return document;
}

/** PDF: one line per text row, rebuilt from the text layer's coordinates. */
async function extractPdf(bytes: Uint8Array) {
  const document = await loadPdfDocument(bytes);

  const lines: string[] = [];
  const pageCharacters: number[] = [];
  const pageCount = Math.min(document.numPages, MAX_TEXT_PAGES);
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const pageLines: string[] = [];
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const rows: Array<{
      y: number;
      cells: Array<{ x: number; text: string }>;
    }> = [];
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const [, , , , x, y] = item.transform as number[];
      // Form fields often sit a fraction of a point off the label baseline;
      // group anything within 3pt so "1. Name:" and its value share a row.
      const row = rows.find((candidate) => Math.abs(candidate.y - y) <= 3);
      if (row) row.cells.push({ x, text: item.str });
      else rows.push({ y, cells: [{ x, text: item.str }] });
    }
    for (const row of rows.sort((a, b) => b.y - a.y)) {
      pageLines.push(
        row.cells
          .sort((a, b) => a.x - b.x)
          .map((cell) => cell.text.trim())
          .filter(Boolean)
          .join("  "),
      );
    }
    pageCharacters.push(normaliseText(pageLines.join("\n")).length);
    lines.push(...pageLines);
    page.cleanup();
  }
  await document.destroy();

  return {
    text: normaliseText(lines.join("\n")),
    pages: document.numPages,
    pageCharacters,
    truncatedPages: document.numPages > MAX_TEXT_PAGES,
  };
}

const stripTags = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

/**
 * DOCX HTML → text. Tables keep their rows ("label | value | …"); paragraphs
 * and headings become their own lines, preserving the original order.
 */
function htmlToText(html: string) {
  const lines: string[] = [];
  const blockPattern =
    /<table[\s\S]*?<\/table>|<p[\s\S]*?<\/p>|<h[1-6][\s\S]*?<\/h[1-6]>|<li[\s\S]*?<\/li>|<div[\s\S]*?<\/div>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const pushText = (raw: string) => {
    for (const line of stripTags(raw).split(/\n+/)) {
      const value = line.replace(/\s{2,}/g, " ").trim();
      if (value) lines.push(value);
    }
  };

  while ((match = blockPattern.exec(html))) {
    if (match.index > lastIndex) pushText(html.slice(lastIndex, match.index));
    const block = match[0];
    if (/^<table/i.test(block)) {
      for (const row of block.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
        const cells = (row.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) ?? [])
          .map((cell) => stripTags(cell))
          .filter(Boolean);
        if (cells.length > 0) lines.push(cells.join(" | "));
      }
    } else {
      pushText(block);
    }
    lastIndex = blockPattern.lastIndex;
  }
  if (lastIndex < html.length) pushText(html.slice(lastIndex));

  return normaliseText(lines.join("\n"));
}

/** DOCX: paragraphs and table rows (each cell separated with `|`). */
async function extractDocx(bytes: Uint8Array) {
  let mammoth: typeof import("mammoth");
  try {
    mammoth = await import("mammoth");
  } catch {
    throw new MaidImportError(
      "Word support is unavailable on this server. Please upload a PDF.",
      { status: 503, code: "docx_unavailable" },
    );
  }

  let html: string;
  try {
    html = (await mammoth.convertToHtml({ buffer: Buffer.from(bytes) })).value;
  } catch {
    throw new MaidImportError(
      "That Word document could not be read. It may be corrupted.",
      { code: "corrupt_docx" },
    );
  }

  const tables = (html.match(/<table/gi) ?? []).length;
  return { text: htmlToText(html), tables };
}

/**
 * Reads PDF/DOCX bytes into text. Nothing is written to disk and no file is
 * retained after the request finishes.
 */
export async function extractDocumentText(input: {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
}): Promise<ExtractedDocument> {
  const source = detectDocumentType(input);
  const extracted =
    source === "pdf"
      ? await extractPdf(input.bytes)
      : await extractDocx(input.bytes);

  const characters = extracted.text.length;
  const truncated =
    characters > RULE_TEXT_LIMIT ||
    ("truncatedPages" in extracted && extracted.truncatedPages === true);
  const text = truncated
    ? extracted.text.slice(0, RULE_TEXT_LIMIT)
    : extracted.text;

  if (characters < 20) {
    // A PDF may legitimately have no text layer (a scan). The client can OCR
    // its rendered pages, so return an empty document instead of failing.
    if (source === "docx")
      throw new MaidImportError(
        "No readable text was found in that Word document.",
        { code: "empty_document" },
      );
  }

  const pages = "pages" in extracted ? extracted.pages : undefined;
  return {
    text,
    source,
    characters,
    pages,
    tables: "tables" in extracted ? extracted.tables : undefined,
    truncated,
    looksScanned:
      source === "pdf" && characters < Math.max(40, 40 * (pages ?? 1)),
    pageCharacters:
      "pageCharacters" in extracted ? extracted.pageCharacters : undefined,
  };
}
