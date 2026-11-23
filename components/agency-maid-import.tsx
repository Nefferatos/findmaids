"use client";

import { useRef, useState } from "react";
import { ocrPdf, PdfOcrError } from "@/lib/maids/import/client-ocr";
import type { MaidDraftPatch } from "@/lib/maids/draft";
import { maidFieldLabel } from "@/lib/maids/import/labels";
import {
  MAID_IMPORT_ACCEPT_ATTRIBUTE,
  MAID_IMPORT_MAX_BYTES,
  type MaidImportResult,
  type MaidImportReview,
} from "@/lib/maids/import/types";

const formatBytes = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const ACCEPTED_EXTENSIONS = [".pdf", ".docx"];

const RECORD_KEYS = [
  "languageSkills",
  "workAreas",
  "otherInformation",
  "pastIllnesses",
  "agencyContact",
] as const;

/** Combines the text-layer draft with the OCR draft (records merge by key). */
function mergePatches(
  base: MaidDraftPatch,
  patch: MaidDraftPatch,
): MaidDraftPatch {
  const merged: MaidDraftPatch = { ...base, ...patch };
  for (const key of RECORD_KEYS) {
    const current = base[key] as Record<string, unknown> | undefined;
    const next = patch[key] as Record<string, unknown> | undefined;
    if (current || next)
      (merged as Record<string, unknown>)[key] = {
        ...(current ?? {}),
        ...(next ?? {}),
      };
  }
  return merged;
}

function validateFile(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.some((extension) => name.endsWith(extension)))
    return "Only PDF and Word (.docx) files can be imported.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAID_IMPORT_MAX_BYTES)
    return "That file is larger than 8 MB. Please upload a smaller document.";
  return null;
}

export function AgencyMaidImport({
  disabled = false,
  hasExistingValues,
  onApply,
}: {
  disabled?: boolean;
  hasExistingValues: boolean;
  onApply: (patch: MaidDraftPatch, mode: "fill" | "replace") => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<MaidImportResult | null>(null);
  const [applied, setApplied] = useState<"fill" | "replace" | null>(null);
  const [mergedDraft, setMergedDraft] = useState<MaidDraftPatch>({});
  const [foundKeys, setFoundKeys] = useState<string[]>([]);
  const [ocrReview, setOcrReview] = useState<MaidImportReview[]>([]);
  const [ocrWarnings, setOcrWarnings] = useState<string[]>([]);
  const [ocrWarning, setOcrWarning] = useState("");
  const [ocrPages, setOcrPages] = useState<number | null>(null);
  const [stage, setStage] = useState("");
  const [scanComplete, setScanComplete] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);

  function resetScanState() {
    setResult(null);
    setApplied(null);
    setMergedDraft({});
    setFoundKeys([]);
    setOcrReview([]);
    setOcrWarnings([]);
    setOcrWarning("");
    setOcrPages(null);
    setStage("");
    setScanComplete(false);
    setAutoFilled(false);
    setError("");
  }

  function choose(next: File | null) {
    resetScanState();
    if (!next) {
      setFile(null);
      return;
    }
    const problem = validateFile(next);
    if (problem) {
      setFile(null);
      setError(problem);
      return;
    }
    setFile(next);
  }

  async function extract() {
    if (!file || disabled) return;
    resetScanState();
    setBusy(true);
    setStage("Reading PDF…");
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/agency/maids/import", {
        method: "POST",
        body,
      });
      const payload = (await response.json().catch(() => ({}))) as
        MaidImportResult | { error?: string };
      if (!response.ok || !("draft" in payload)) {
        setError(
          ("error" in payload && payload.error) ||
            "The document could not be processed. Please try again.",
        );
        setStage("");
        return;
      }

      setResult(payload);
      setMergedDraft(payload.draft);
      setFoundKeys(payload.found);
      if (Object.keys(payload.draft).length > 0) {
        onApply(payload.draft, "fill");
        setApplied("fill");
        setAutoFilled(true);
      }

      if (payload.meta.needsOcr && file.name.toLowerCase().endsWith(".pdf")) {
        setStage("Detecting scanned pages…");
        try {
          const ocr = await ocrPdf(file, {
            pages: payload.meta.ocrPages,
            onProgress: setStage,
          });
          if (ocr.text.trim().length >= 20) {
            setStage("Mapping biodata fields…");
            const parseResponse = await fetch("/api/agency/maids/import/ocr", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: ocr.text }),
            });
            const parsed = (await parseResponse.json().catch(() => ({}))) as {
              draft?: MaidDraftPatch;
              found?: string[];
              review?: MaidImportReview[];
              warnings?: string[];
              error?: string;
            };
            if (!parseResponse.ok || !parsed.draft)
              throw new PdfOcrError(
                parsed.error ??
                  "The scanned text could not be mapped to fields.",
                "render_failed",
              );
            setOcrPages(ocr.pages);
            setOcrReview(parsed.review ?? []);
            setOcrWarnings(parsed.warnings ?? []);
            setMergedDraft((current) => mergePatches(current, parsed.draft!));
            setFoundKeys((current) => [
              ...new Set([...current, ...(parsed.found ?? [])]),
            ]);
            if (Object.keys(parsed.draft).length > 0) {
              onApply(parsed.draft, "fill");
              setApplied("fill");
              setAutoFilled(true);
            }
          }

          if (ocr.portrait && !payload.draft.photoUrl) {
            setStage("Extracting portrait…");
            const portraitForm = new FormData();
            portraitForm.set(
              "file",
              new File([ocr.portrait], "portrait.webp", {
                type: ocr.portrait.type || "image/webp",
              }),
            );
            portraitForm.set("kind", "maid");
            const uploadResponse = await fetch("/api/agency/media", {
              method: "POST",
              body: portraitForm,
            });
            const upload = (await uploadResponse.json().catch(() => ({}))) as {
              url?: string;
            };
            if (uploadResponse.ok && upload.url) {
              const photoPatch: MaidDraftPatch = {
                photoUrl: upload.url,
                photoUrls: [upload.url],
              };
              setMergedDraft((current) => ({ ...current, ...photoPatch }));
              onApply(photoPatch, "fill");
              setAutoFilled(true);
            }
          }
        } catch (ocrError) {
          setOcrWarning(
            ocrError instanceof PdfOcrError
              ? ocrError.message
              : "OCR could not read this scan. Please fill the fields manually.",
          );
        }
      }

      setStage("Autofill completed");
      setScanComplete(true);
    } catch {
      setError("The upload failed. Check your connection and try again.");
      setStage("");
    } finally {
      setBusy(false);
    }
  }

  function apply(mode: "fill" | "replace") {
    if (!result) return;
    if (mode === "replace" && hasExistingValues) {
      const confirmed = window.confirm(
        "Replace the values already in the form with the document's values?",
      );
      if (!confirmed) return;
    }
    onApply(mergedDraft, mode);
    setApplied(mode);
    setAutoFilled(true);
  }

  const importedCount = foundKeys.length;
  const photoUrl =
    typeof mergedDraft.photoUrl === "string" ? mergedDraft.photoUrl : "";
  const warnings = [...new Set([...(result?.warnings ?? []), ...ocrWarnings])];
  const review = [...(result?.review ?? []), ...ocrReview].filter(
    (item, index, all) =>
      all.findIndex(
        (other) => other.field === item.field && other.message === item.message,
      ) === index,
  );
  const knownLabels = new Set(foundKeys.map((key) => maidFieldLabel(key)));
  const missing = (result?.missing ?? []).filter(
    (label) => !knownLabels.has(label),
  );

  return (
    <section className="rounded-md border border-dashed border-[#9fb0c7] bg-[#f7f9fc] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-extrabold tracking-wide text-[#1f3b63] uppercase">
          Import Biodata (PDF or Word)
        </h2>
        <span className="text-[11px] text-[#606c7c]">
          Extracted data is a draft — review it before saving.
        </span>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (disabled) return;
          choose(event.dataTransfer.files?.[0] ?? null);
        }}
        className={`mt-3 rounded border-2 border-dashed p-4 text-center transition ${
          dragging ? "border-[#1f3b63] bg-white" : "border-[#c3cfdd] bg-white"
        }`}
      >
        <p className="text-[12px] font-semibold text-[#1f3b63]">
          Drag and drop the biodata file here
        </p>
        <p className="mt-1 text-[11px] text-[#606c7c]">
          PDF or Word (.docx), up to 8 MB
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={MAID_IMPORT_ACCEPT_ATTRIBUTE}
            className="sr-only"
            disabled={disabled || busy}
            onChange={(event) => {
              choose(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
            className="rounded border border-[#1f3b63] px-3 py-1.5 text-[12px] font-semibold text-[#1f3b63] disabled:opacity-60"
          >
            Browse files
          </button>
          <button
            type="button"
            disabled={disabled || busy || !file}
            onClick={() => void extract()}
            className="bg-primary rounded px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Reading document…" : "Extract Biodata"}
          </button>
        </div>
      </div>
      {file ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded border bg-white px-3 py-2 text-[12px]">
          <span className="text-[#1f3b63]">
            <strong>{file.name}</strong>{" "}
            <span className="text-[#606c7c]">· {formatBytes(file.size)}</span>
          </span>
          <span className="flex items-center gap-2">
            {busy ? (
              <span
                role="status"
                aria-live="polite"
                className="flex items-center gap-1 text-[#606c7c]"
              >
                <span className="inline-block size-3 animate-spin rounded-full border-2 border-[#c3cfdd] border-t-[#1f3b63]" />
                Scanning…
              </span>
            ) : null}
            <button
              type="button"
              className="rounded border px-2 py-1"
              disabled={busy}
              onClick={() => choose(null)}
            >
              Remove file
            </button>
          </span>
        </div>
      ) : null}

      {busy && stage ? (
        <p
          role="status"
          aria-live="polite"
          className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-[#2d4a73]"
        >
          <span className="inline-block size-3 animate-spin rounded-full border-2 border-[#c3cfdd] border-t-[#1f3b63]" />
          {stage}
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded border border-[#e2b4b4] bg-[#fdf3f3] px-3 py-2 text-[12px] text-[#7a1f1f]"
        >
          {error}
        </p>
      ) : null}

      {scanComplete && autoFilled ? (
        <p
          role="status"
          className="mt-3 rounded border border-[#cfe0cf] bg-[#f4fbf4] px-3 py-2 text-[12px] font-semibold text-[#14532d]"
        >
          Scan complete. Biodata fields have been automatically filled. Please
          review the information before saving.
        </p>
      ) : scanComplete ? (
        <p className="mt-3 rounded border border-[#e7d8b0] bg-[#fffbea] px-3 py-2 text-[12px] text-[#713f12]">
          The scan finished, but no fields could be read automatically. Please
          fill them in manually.
        </p>
      ) : null}

      {ocrWarning ? (
        <p className="mt-2 text-[11px] text-[#713f12]">⚠ {ocrWarning}</p>
      ) : null}

      {result ? (
        <div className="mt-3 grid gap-3 rounded border bg-white p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[12px] font-semibold text-[#14532d]">
              {importedCount} field{importedCount === 1 ? "" : "s"} found in{" "}
              {result.meta.fileName}
            </p>
            <span className="text-[11px] text-[#606c7c]">
              {result.meta.source.toUpperCase()}
              {result.meta.pages ? ` · ${result.meta.pages} page(s)` : ""}
              {result.meta.tables ? ` · ${result.meta.tables} table(s)` : ""}
              {ocrPages ? ` · OCR ${ocrPages} page(s)` : ""}
              {` · ${result.meta.extractor === "ai" ? "AI reader" : "text reader"}`}
            </span>
          </div>

          {photoUrl ? (
            <div className="flex items-center gap-3 rounded border border-[#cfe0cf] bg-[#f4fbf4] p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt="Photo found in the document"
                className="h-[84px] w-[64px] rounded border border-[#c3cfdd] object-cover"
              />
              <div className="text-[11px] text-[#14532d]">
                <p className="text-[12px] font-semibold">Photo found</p>
                <p>
                  It has been attached to the form. Photos you already uploaded
                  are kept.
                </p>
              </div>
            </div>
          ) : null}

          {importedCount > 0 ? (
            <ul className="flex flex-wrap gap-1">
              {foundKeys.map((key) => (
                <li
                  key={key}
                  className="rounded bg-[#eef2f8] px-2 py-0.5 text-[11px] font-semibold text-[#2d4a73]"
                >
                  {maidFieldLabel(key)}
                </li>
              ))}
            </ul>
          ) : null}

          {warnings.length > 0 ? (
            <ul className="grid gap-1 text-[11px] text-[#713f12]">
              {warnings.map((warning) => (
                <li key={warning}>⚠ {warning}</li>
              ))}
            </ul>
          ) : null}

          {review.length > 0 ? (
            <div className="text-[11px] text-[#7a1f1f]">
              <p className="font-semibold">Needs your review:</p>
              <ul className="mt-1 grid gap-1">
                {review.slice(0, 12).map((item, index) => (
                  <li key={`${item.field}-${index}`}>
                    <strong>{maidFieldLabel(item.field)}</strong>:{" "}
                    {item.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {missing.length > 0 ? (
            <p className="text-[11px] text-[#606c7c]">
              Not found: {missing.join(", ")}.
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => apply("fill")}
              className="bg-primary rounded px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60"
            >
              Fill empty fields
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => apply("replace")}
              className="rounded border px-3 py-1.5 text-[12px] font-semibold"
            >
              Replace all fields
            </button>
            {applied ? (
              <span className="text-[11px] text-[#14532d]">
                Applied to the form below — review, then save.
              </span>
            ) : null}
          </div>
          <p className="text-[11px] text-[#606c7c]">
            {photoUrl
              ? "The document photo is attached to the form; replace it under “Photos & video” if needed."
              : result.meta.photo?.found && !result.meta.photo.uploaded
                ? "A photo was found in the document but could not be uploaded — add it under “Photos & video”."
                : "No photo was detected in the document — add one under “Photos & video” if needed."}
          </p>
        </div>
      ) : null}
    </section>
  );
}
