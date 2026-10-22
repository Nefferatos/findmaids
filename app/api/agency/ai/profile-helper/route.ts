import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isFeatureEnabled } from "@/lib/ai/flags";
import { maskPii } from "@/lib/ai/guardrails";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "AGENCY")
    return NextResponse.json(
      { error: "Agency access required." },
      { status: 401 },
    );
  if (
    !(await checkRateLimit(`ai-profile-helper:${session.user.id}`, 10, 3600))
      .allowed
  )
    return NextResponse.json(
      { error: "Suggestion limit reached. Try again later." },
      { status: 429 },
    );
  const agency = await prisma.agency.findUnique({
    where: { ownerId: session.user.id },
    select: {
      id: true,
      name: true,
      description: true,
      city: true,
      province: true,
      services: true,
      languages: true,
    },
  });
  if (!agency || !(await isFeatureEnabled("agency_profile_helper", agency.id)))
    return NextResponse.json(
      { error: "Profile suggestions are not enabled." },
      { status: 404 },
    );
  const facts = [
    agency.name,
    `based in ${agency.city}, ${agency.province}`,
    agency.services.length
      ? `Services include ${agency.services.join(", ")}`
      : "Contact the agency to confirm available services",
    agency.languages.length
      ? `Languages: ${agency.languages.join(", ")}`
      : "Contact the agency to confirm languages spoken",
  ];
  const existing = maskPii(agency.description).trim();
  const suggestion =
    `${facts.join(". ")}. ${existing ? `\n\n${existing}` : "Contact our team to discuss your household staffing needs and the services currently available."}`.slice(
      0,
      1600,
    );
  return NextResponse.json({
    suggestion,
    saved: false,
    mode: "editable-draft",
  });
}
