import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { IMPORTANT_FIELDS, parseMaidBiodata } from "@/lib/maids/import/parse";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  text: z.string().min(20).max(200_000),
});

/**
 * Maps OCR text (read on the user's device) onto the Add Maid form fields.
 * The text is parsed in memory and never stored or logged.
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
    !(await checkRateLimit(`maid-import-ocr:${session.user.id}`, 60, 3600))
      .allowed
  )
    return NextResponse.json(
      { error: "Too many scans. Try again later." },
      { status: 429 },
    );

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return NextResponse.json(
      { error: "The scanned text was empty or too long." },
      { status: 400 },
    );

  const rules = parseMaidBiodata(body.data.text);
  return NextResponse.json(
    {
      draft: rules.draft,
      found: Object.keys(rules.draft),
      missing: IMPORTANT_FIELDS.filter(([key]) => !(key in rules.draft)).map(
        ([, label]) => label,
      ),
      review: rules.review,
      warnings: rules.warnings,
      characters: body.data.text.length,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
