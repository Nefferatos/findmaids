import { getAiProvider } from "@/lib/ai/provider";
import type { MaidDraftPatch } from "@/lib/maids/draft";
import { extractWithAi } from "@/lib/maids/import/ai";
import { extractDocumentText } from "@/lib/maids/import/document";
import { IMPORTANT_FIELDS, parseMaidBiodata } from "@/lib/maids/import/parse";
import type { MaidImportResult } from "@/lib/maids/import/types";

const RECORD_KEYS = [
  "languageSkills",
  "workAreas",
  "otherInformation",
  "pastIllnesses",
  "agencyContact",
] as const;

/** Primary (AI) values win; the rules parser fills the gaps it found. */
function mergeDrafts(
  primary: MaidDraftPatch,
  fallback: MaidDraftPatch,
): MaidDraftPatch {
  const merged: Record<string, unknown> = { ...fallback, ...primary };
  for (const key of RECORD_KEYS) {
    const primaryRecord = primary[key] as Record<string, unknown> | undefined;
    const fallbackRecord = fallback[key] as Record<string, unknown> | undefined;
    if (!primaryRecord && !fallbackRecord) continue;
    merged[key] = { ...(fallbackRecord ?? {}), ...(primaryRecord ?? {}) };
  }
  for (const key of ["employment"] as const) {
    if (!primary[key] && fallback[key]) merged[key] = fallback[key];
  }
  return merged as MaidDraftPatch;
}

/**
 * Full document → draft pipeline: type detection, text extraction (PDF/DOCX),
 * AI pass when configured, deterministic fallback, and a review summary.
 * Nothing is written to the database here.
 */
export async function extractMaidBiodata(input: {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
}): Promise<MaidImportResult> {
  const byteLength = input.bytes.byteLength;
  const document = await extractDocumentText(input);
  const aiConfigured = getAiProvider().name !== "mock";
  const missingEverything = IMPORTANT_FIELDS.map(([, label]) => label);
  const sparsePages = (document.pageCharacters ?? [])
    .map((count, index) => (count < 40 ? index + 1 : 0))
    .filter((page) => page > 0);
  const allPages = Array.from(
    { length: Math.min(document.pages ?? 1, 5) },
    (_, index) => index + 1,
  );
  const ocrPages = sparsePages.length > 0 ? sparsePages : allPages;

  if (document.looksScanned || document.text.trim().length === 0) {
    return {
      draft: {},
      found: [],
      missing: missingEverything,
      review: [],
      warnings: [
        "This PDF has no text layer (it is a scan). Its pages will be read with OCR on your device before the form is filled.",
      ],
      meta: {
        source: document.source,
        fileName: input.fileName,
        bytes: byteLength,
        characters: document.characters,
        pages: document.pages,
        tables: document.tables,
        extractor: "rules",
        aiConfigured,
        truncated: document.truncated,
        ocr: "client",
        needsOcr: true,
        ocrPages,
      },
    };
  }

  const rules = parseMaidBiodata(document.text);
  let draft: MaidDraftPatch = rules.draft;
  let review = [...rules.review];
  const warnings = [...rules.warnings];
  let extractor: "ai" | "rules" = "rules";

  const ai = await extractWithAi(document.text);
  if (ai) {
    extractor = "ai";
    draft = mergeDrafts(ai.draft, rules.draft);
    review = [...ai.review, ...rules.review];
  } else if (aiConfigured) {
    warnings.push(
      "The AI reader could not process this document, so the built-in text reader was used instead.",
    );
  }

  const found = Object.keys(draft);
  if (found.length === 0) {
    warnings.push(
      "No maid details could be recognised. The document layout may be unusual — please type the details manually.",
    );
  }
  if (document.truncated)
    warnings.push(
      "The document is long; only the first part was processed. Check the remaining sections manually.",
    );

  const importantFound = IMPORTANT_FIELDS.filter(
    ([key]) => key in draft,
  ).length;
  const needsOcr = document.source === "pdf" && importantFound < 4;
  if (needsOcr)
    warnings.push(
      "Only a few fields were found in the PDF text layer. OCR will read the pages on your device to fill the rest.",
    );

  return {
    draft,
    found,
    missing: IMPORTANT_FIELDS.filter(([key]) => !(key in draft)).map(
      ([, label]) => label,
    ),
    review,
    warnings: [...new Set(warnings)],
    meta: {
      source: document.source,
      fileName: input.fileName,
      bytes: byteLength,
      characters: document.characters,
      pages: document.pages,
      tables: document.tables,
      extractor,
      aiConfigured,
      truncated: document.truncated,
      ocr: needsOcr ? "client" : "not_needed",
      needsOcr,
      ocrPages: needsOcr ? ocrPages : undefined,
    },
  };
}
