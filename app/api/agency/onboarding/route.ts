import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  onboardingDraftSchema,
  onboardingSubmissionSchema,
} from "@/lib/onboarding";
import { calculateProfileCompleteness } from "@/lib/agency";

async function agencyUser() {
  const session = await auth();
  if (!session?.user || session.user.role !== "AGENCY") return null;
  return session.user;
}

export async function GET() {
  const user = await agencyUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [agency, draft] = await Promise.all([
    prisma.agency.findUnique({ where: { ownerId: user.id } }),
    prisma.agencyOnboardingDraft.findUnique({ where: { userId: user.id } }),
  ]);
  return NextResponse.json({
    agency,
    draft: draft?.data ?? {},
    currentStep: draft?.currentStep ?? 1,
  });
}

export async function PUT(request: Request) {
  const user = await agencyUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.email)
    return NextResponse.json(
      { error: "Verified account email is required." },
      { status: 403 },
    );
  const body = (await request.json().catch(() => null)) as {
    data?: unknown;
    currentStep?: unknown;
  } | null;
  const parsed = onboardingDraftSchema.safeParse(body?.data);
  const step = Number(body?.currentStep);
  if (!parsed.success || !Number.isInteger(step) || step < 1 || step > 5)
    return NextResponse.json(
      { error: "Invalid onboarding draft." },
      { status: 400 },
    );
  const existing = await prisma.agencyOnboardingDraft.findUnique({
    where: { userId: user.id },
  });
  if (existing) {
    await prisma.agencyOnboardingDraft.update({
      where: { userId: user.id },
      data: { data: parsed.data, currentStep: step },
    });
  } else {
    await prisma.agencyOnboardingDraft.create({
      data: { userId: user.id, data: parsed.data, currentStep: step },
    });
  }
  return NextResponse.json({ saved: true });
}

export async function POST(request: Request) {
  const user = await agencyUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = onboardingSubmissionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Complete the required onboarding fields before submitting." },
      { status: 400 },
    );
  const data = parsed.data;
  if ((data.photos?.length ?? 0) > 3)
    return NextResponse.json(
      {
        error:
          "Basic Free includes up to 3 gallery photos. Remove extra photos before submission.",
      },
      { status: 400 },
    );
  const existing = await prisma.agency.findUnique({
    where: { ownerId: user.id },
  });
  if (existing)
    return NextResponse.json(
      { error: "An agency profile already exists for this account." },
      { status: 409 },
    );
  const slugExists = await prisma.agency.findUnique({
    where: { slug: data.slug },
    select: { id: true },
  });
  if (slugExists)
    return NextResponse.json(
      { error: "That profile URL is already in use." },
      { status: 409 },
    );
  const completeness = calculateProfileCompleteness(data);
  const pendingProspect = await prisma.prospect.findFirst({
    where: {
      agencyId: null,
      OR: [
        { email: { equals: data.email, mode: "insensitive" } },
        ...(data.licenseNumber ? [{ licenseNumber: data.licenseNumber }] : []),
        { agencyName: { equals: data.name, mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "asc" },
  });
  const agency = await prisma.$transaction(async (tx) => {
    const created = await tx.agency.create({
      data: {
        ownerId: user.id,
        name: data.name,
        slug: data.slug,
        description: data.description,
        yearEstablished: data.yearEstablished
          ? Number(data.yearEstablished)
          : null,
        licenseNumber: data.licenseNumber || null,
        address: data.address,
        city: data.city,
        province: data.province,
        phone: data.phone,
        whatsapp: data.whatsapp || null,
        email: data.email.toLowerCase(),
        website: data.website || null,
        facebook: data.facebook || null,
        services: data.services,
        nationalitiesServed: data.nationalitiesServed,
        languages: data.languages,
        logoUrl: data.logoUrl || null,
        bannerUrl: data.bannerUrl || null,
        profileCompleteness: completeness,
        status: "PENDING",
        submittedAt: new Date(),
        onboardingStep: 5,
        photos: {
          create: (data.photos ?? []).map((photo, sortOrder) => ({
            url: photo.url,
            caption: photo.caption,
            sortOrder,
          })),
        },
      },
    });
    await tx.agencyOnboardingDraft.deleteMany({ where: { userId: user.id } });
    return created;
  });
  if (pendingProspect) {
    const nextStage = pendingProspect.stage === "DO_NOT_CONTACT" ? pendingProspect.stage : "PROFILE_DRAFTED";
    await prisma.$transaction([
      prisma.prospect.update({ where: { id: pendingProspect.id }, data: { agencyId: agency.id, stage: nextStage } }),
      prisma.auditLog.create({ data: { userId: user.id, agencyId: agency.id, action: "PROSPECT_LINKED_TO_AGENCY", entity: "Prospect", entityId: pendingProspect.id, after: { agencyId: agency.id, stage: nextStage } } }),
    ]);
  }
  return NextResponse.json(
    { agencyId: agency.id, status: agency.status },
    { status: 201 },
  );
}
