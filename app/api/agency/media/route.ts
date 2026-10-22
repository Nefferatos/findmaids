import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 30;
const maxBytes = 5 * 1024 * 1024;
const allowedFormats = new Set(["jpeg", "png", "webp"]);
const kindSchema = z.enum(["logo", "banner", "photo"]);
const sizeSchema = z.number().int().positive().max(maxBytes);

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "AGENCY")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (
    process.env.NODE_ENV === "production" &&
    process.env.MEDIA_STORAGE !== "local"
  ) {
    return NextResponse.json(
      { error: "Production media storage is not configured." },
      { status: 503 },
    );
  }
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
          where: { status: "ACTIVE" },
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
  try {
    const image = sharp(input, {
      limitInputPixels: 40_000_000,
      failOn: "error",
    });
    const metadata = await image.metadata();
    if (!metadata.format || !allowedFormats.has(metadata.format))
      return NextResponse.json(
        { error: "Use JPG, PNG, or WebP images." },
        { status: 415 },
      );
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
    const directory = path.join(process.cwd(), "public", "uploads");
    await mkdir(directory, { recursive: true });
    const filename = `${randomUUID()}.webp`;
    await writeFile(path.join(directory, filename), output, { flag: "wx" });
    if (kind === "photo") {
      const ownedAgency = await prisma.agency.findFirst({
        where: { ownerId: session.user.id },
        select: { id: true },
      });
      if (ownedAgency)
        await prisma.agencyPhoto.create({
          data: { agencyId: ownedAgency.id, url: `/uploads/${filename}` },
        });
    }
    return NextResponse.json(
      {
        url: `/uploads/${filename}`,
        width: metadata.width,
        height: metadata.height,
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "The uploaded file is not a valid image." },
      { status: 400 },
    );
  }
}
