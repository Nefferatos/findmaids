import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { calculateProfileCompleteness } from "@/lib/agency";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

const schema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().min(50).max(5000),
  licenseNumber: z.string().trim().max(160).optional().or(z.literal("")),
  address: z.string().trim().min(3).max(300),
  city: z.string().trim().min(2).max(120),
  province: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(40),
  whatsapp: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email().max(254),
  website: z.string().trim().max(255).optional().or(z.literal("")),
  facebook: z.string().trim().max(255).optional().or(z.literal("")),
  yearEstablished: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce
      .number()
      .int()
      .min(1800)
      .max(new Date().getUTCFullYear())
      .nullable()
      .optional(),
  ),
  services: z.array(z.string().max(80)).max(20),
  nationalitiesServed: z.array(z.string().max(80)).max(20),
  languages: z.array(z.string().max(80)).max(20),
  logoUrl: z.string().startsWith("/uploads/").optional().or(z.literal("")),
  bannerUrl: z.string().startsWith("/uploads/").optional().or(z.literal("")),
});

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "AGENCY")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Review the profile fields and retry." },
      { status: 400 },
    );
  const agency = await prisma.agency.findFirst({
    where: { ownerId: session.user.id },
    include: { photos: true },
  });
  if (!agency)
    return NextResponse.json({ error: "Agency not found." }, { status: 404 });
  const changedCritical =
    agency.name !== parsed.data.name ||
    agency.licenseNumber !== (parsed.data.licenseNumber || null);
  const status = changedCritical ? "PENDING" : agency.status;
  const completeness = calculateProfileCompleteness({
    ...parsed.data,
    photos: agency.photos,
  });
  const updated = await prisma.agency.update({
    where: { id: agency.id },
    data: {
      ...parsed.data,
      licenseNumber: parsed.data.licenseNumber || null,
      whatsapp: parsed.data.whatsapp || null,
      website: parsed.data.website || null,
      facebook: parsed.data.facebook || null,
      logoUrl: parsed.data.logoUrl || null,
      bannerUrl: parsed.data.bannerUrl || null,
      profileCompleteness: completeness,
      status,
      ...(changedCritical ? { submittedAt: new Date(), adminNote: null } : {}),
    },
  });
  if (changedCritical && session.user.email) {
    await sendEmail(
      session.user.email,
      "FindMaids profile changes sent for review",
      "Your agency name or licence details changed. The profile is pending approval until the review is complete.",
    );
  }
  return NextResponse.json({
    agency: updated,
    requiresReview: changedCritical,
  });
}
