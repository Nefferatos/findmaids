import type { MaidDraft } from "@/lib/maids/draft";

/** Hard limit for an uploaded biodata file (checked on the client and server). */
export const MAID_IMPORT_MAX_BYTES = 8 * 1024 * 1024;

export const MAID_IMPORT_ACCEPTED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const MAID_IMPORT_ACCEPT_ATTRIBUTE = ".pdf,.docx";

export type MaidImportSource = "pdf" | "docx";

export type MaidImportReview = {
  /** Draft key the reviewer should look at (e.g. `dateOfBirth`). */
  field: string;
  label: string;
  message: string;
};

export type MaidImportPhotoMeta = {
  /** True when an embedded image looked like the FDW's photo. */
  found: boolean;
  /** True when the photo was stored and is ready to attach. */
  uploaded: boolean;
  width?: number;
  height?: number;
};

export type MaidImportMeta = {
  source: MaidImportSource;
  fileName: string;
  bytes: number;
  characters: number;
  pages?: number;
  tables?: number;
  extractor: "ai" | "rules";
  aiConfigured: boolean;
  /** True when the document exceeded the parsing budget and was shortened. */
  truncated: boolean;
  /** `client` means the PDF needs the on-device OCR pass before fields appear. */
  ocr: "not_needed" | "client";
  /** True when the text layer was too thin to fill the form; OCR the pages. */
  needsOcr?: boolean;
  /** 1-based page numbers worth OCR-ing (sparse or scanned pages). */
  ocrPages?: number[];
  /** Embedded photo detection result (absent in older responses). */
  photo?: MaidImportPhotoMeta;
};

export type MaidImportResult = {
  draft: Partial<MaidDraft>;
  /** Draft keys that received a value. */
  found: string[];
  /** Important draft keys with no value in the document. */
  missing: string[];
  review: MaidImportReview[];
  warnings: string[];
  meta: MaidImportMeta;
};

export type ExtractedDocument = {
  text: string;
  source: MaidImportSource;
  characters: number;
  pages?: number;
  tables?: number;
  truncated: boolean;
  looksScanned: boolean;
  /** Character count per page (PDF only), used to target OCR pages. */
  pageCharacters?: number[];
};

export class MaidImportError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(
    message: string,
    options: { status?: number; code?: string } = {},
  ) {
    super(message);
    this.name = "MaidImportError";
    this.status = options.status ?? 400;
    this.code = options.code ?? "invalid_document";
  }
}
