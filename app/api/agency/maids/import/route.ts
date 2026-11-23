import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { extractMaidBiodata } from "@/lib/maids/import";
import { extractDocumentPhoto } from "@/lib/maids/import/photo";
import {
  MAID_IMPORT_MAX_BYTES,
  MaidImportError,
} from "@/lib/maids/import/types";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { storeObject } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Reads a PDF/DOCX biodata file and returns a draft for the Add Maid form.
 * Nothing is persisted: the agency reviews and saves the profile itself.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "AGENCY")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agency = await prisma.agency.findUnique({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!agency)
    return NextResponse.json({ error: "Agency not found." }, { status: 404 });

  if (
    !(await checkRateLimit(`maid-import:${session.user.id}`, 20, 3600)).allowed
  )
    return NextResponse.json(
      { error: "Too many imports. Try again later." },
      { status: 429 },
    );

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Upload a PDF or Word (.docx) biodata file." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File))
    return NextResponse.json(
      { error: "Attach the biodata document to import." },
      { status: 400 },
    );
  if (file.size === 0)
    return NextResponse.json(
      { error: "The uploaded file is empty." },
      { status: 400 },
    );
  if (file.size > MAID_IMPORT_MAX_BYTES)
    return NextResponse.json(
      {
        error:
          "That file is larger than 8 MB. Please upload a smaller document.",
      },
      { status: 413 },
    );

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    // pdf.js transfers the input buffer to its worker, so the photo extractor
    // gets its own copy; otherwise running both parses in parallel detaches
    // the bytes and both fail.
    const photoBytes = bytes.slice();
    const [result, photo] = await Promise.all([
      extractMaidBiodata({
        bytes,
        fileName: file.name,
        mimeType: file.type,
      }),
      extractDocumentPhoto({
        bytes: photoBytes,
        fileName: file.name,
        mimeType: file.type,
      }).catch((photoError) => {
        // A missing photo must never block the text import.
        console.warn("[maid-import] photo extraction skipped", {
          userId: session.user.id,
          message:
            photoError instanceof Error
              ? photoError.name.slice(0, 60)
              : "unknown",
        });
        return null;
      }),
    ]);

    if (photo && !result.meta.needsOcr) {
      try {
        const url = await storeObject({
          bucket: "media",
          key: `${randomUUID()}.webp`,
          body: photo.bytes,
          contentType: photo.contentType,
          public: true,
        });
        result.draft.photoUrl = url;
        result.draft.photoUrls = [url];
        if (!result.found.includes("photoUrl")) result.found.push("photoUrl");
        result.meta.photo = {
          found: true,
          uploaded: true,
          width: photo.width,
          height: photo.height,
        };
      } catch {
        result.meta.photo = {
          found: true,
          uploaded: false,
          width: photo.width,
          height: photo.height,
        };
        result.warnings.push(
          "A photo was found in the document, but it could not be uploaded. Add it under “Photos & video”.",
        );
      }
    } else {
      // Scanned documents are one big page image; the browser crops the
      // portrait from the rendered page instead of attaching the whole scan.
      result.meta.photo = { found: false, uploaded: false };
    }

    return NextResponse.json(result, {
      // The draft contains personal data: never cache or reuse it.
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof MaidImportError)
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    // Never leak parser/provider internals (or document contents) to the client.
    console.error("[maid-import] extraction failed", {
      userId: session.user.id,
      bytes: file.size,
      extension: file.name.toLowerCase().split(".").pop()?.slice(0, 8),
      message:
        error instanceof Error
          ? `${error.name}: ${error.message}`.slice(0, 300)
          : "unknown",
    });
    return NextResponse.json(
      {
        error:
          "The document could not be processed. Please try again or upload a different file.",
      },
      { status: 500 },
    );
  }
}
