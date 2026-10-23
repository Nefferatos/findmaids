import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { storeObject } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 30;
const maxBytes = 5 * 1024 * 1024;
const allowedFormats = new Set(["jpeg", "png", "webp"]);
const kindSchema = z.enum(["logo", "banner", "photo"]);
const sizeSchema = z.number().int().positive().max(maxBytes);

async function prepareImage(input: Buffer, kind: "logo" | "banner" | "photo") {
  try {
    const image = sharp(input, {
      limitInputPixels: 40_000_000,
      failOn: "error",
    });
    const metadata = await image.metadata();
    if (!metadata.format || !allowedFormats.has(metadata.format))
      return {
        ok: false as const,
        status: 415,
        error: "Use JPG, PNG, or WebP images.",
      };
    const output = await image
      .rotate()
      .resize({
        width: kind === "logo" ? 1200 : 2400,
        height: kind === "logo" ? 1200 : 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();
    return { ok: true as const, metadata, output };
  } catch {
    return {
      ok: false as const,
      status: 400,
      error: "The uploaded file is not a valid image.",
    };
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "AGENCY")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await checkRateLimit(`media:${session.user.id}`, 20, 3600)).allowed)
    return NextResponse.json(
      { error: "Upload limit reached. Try later." },
      { status: 429 },
    );
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const parsedKind = kindSchema.safeParse(form?.get("kind"));
  const kind = parsedKind.success ? parsedKind.data : null;
  if (!(file instanceof File) || !kind)
    return NextResponse.json(
      { error: "Select a supported image file." },
      { status: 400 },
    );
  if (!sizeSchema.safeParse(file.size).success)
    return NextResponse.json(
      { error: "Images must be 5 MB or smaller." },
      { status: 400 },
    );
  if (kind === "photo") {
    const agency = await prisma.agency.findUnique({
      where: { ownerId: session.user.id },
      include: {
        _count: { select: { photos: true } },
        subscriptions: {
          where: { status: "ACTIVE", OR: [{ endDate: null }, { endDate: { gte: new Date() } }] },
          include: { plan: true },
          take: 1,
        },
      },
    });
    const maxPhotos = agency?.subscriptions[0]?.plan.maxPhotos ?? 25;
    if (agency && agency._count.photos >= maxPhotos)
      return NextResponse.json(
        {
          error: `Your current plan allows ${maxPhotos} gallery photos. Upgrade to add more.`,
        },
        { status: 403 },
      );
  }
  const input = Buffer.from(await file.arrayBuffer());
  const processed = await prepareImage(input, kind);
  if (!processed.ok)
    return NextResponse.json(
      { error: processed.error },
      { status: processed.status },
    );
  const { metadata, output } = processed;
  const filename = `${randomUUID()}.webp`;
  let url: string;
  try {
    url = await storeObject({
      bucket: "media",
      key: filename,
      body: output,
      contentType: "image/webp",
      public: true,
    });
  } catch {
    return NextResponse.json(
      { error: "Image storage is temporarily unavailable. Please retry." },
      { status: 503 },
    );
  }
  if (kind === "photo") {
    const ownedAgency = await prisma.agency.findFirst({
      where: { ownerId: session.user.id },
      select: { id: true },
    });
    if (ownedAgency)
      await prisma.agencyPhoto.create({
        data: { agencyId: ownedAgency.id, url },
      });
  }
  return NextResponse.json(
    { url, width: metadata.width, height: metadata.height },
    { status: 201 },
  );
}
