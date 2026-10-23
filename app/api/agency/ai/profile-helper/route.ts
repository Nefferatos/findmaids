import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isFeatureEnabled } from "@/lib/ai/flags";
import { maskPii } from "@/lib/ai/guardrails";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkAiBudget } from "@/lib/ai/budget";
import { generateLoggedText } from "@/lib/ai/call";
import { getAiProvider } from "@/lib/ai/provider";
import { z } from "zod";

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
  const budget = await checkAiBudget(agency.id);
  if (!budget.allowed)
    return NextResponse.json(
      {
        error:
          "AI monthly allowance reached. You can still edit your profile manually.",
      },
      { status: 429 },
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
  const safeFacts = maskPii(facts.join(". "));
  let suggestion: unknown;
  if (getAiProvider().name === "mock") {
    suggestion = {
      description: `${safeFacts}. Contact our team to discuss your household staffing needs and confirm current availability.`,
      services: agency.services.map((service) => `• ${service}`),
      adCopy: `${agency.name} in ${agency.city}: explore our listed household staffing services. Contact us to confirm current details.`,
      socialPost: `Looking for household staffing support in ${agency.city}? ${agency.name} can discuss its listed services with you. Contact our team to confirm current details.`,
      filipino: `${agency.name} ay matatagpuan sa ${agency.city}, ${agency.province}. Makipag-ugnayan sa aming team upang kumpirmahin ang mga serbisyong nakalista at kasalukuyang detalye.`,
    };
  } else {
    const result = await generateLoggedText({
      feature: "agency_profile_helper",
      promptVersion: "agency-profile-helper.v1",
      agencyId: agency.id,
      maxTokens: 700,
      messages: [
        {
          role: "system",
          content:
            "Create a JSON object with description, services:string[], adCopy, socialPost and filipino. Use only supplied facts. Do not invent years, awards, licences, guarantees, prices or availability. If facts are missing, say contact the agency to confirm. This is an editable draft, never publish it.",
        },
        { role: "user", content: safeFacts },
      ],
    });
    suggestion = z
      .object({
        description: z.string().max(3000),
        services: z.array(z.string().max(200)).max(20),
        adCopy: z.string().max(500),
        socialPost: z.string().max(700),
        filipino: z.string().max(3000),
      })
      .parse(JSON.parse(result.text));
  }
  return NextResponse.json({
    suggestion,
    saved: false,
    mode: "editable-draft",
  });
}
