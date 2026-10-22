import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { enquirySubmissionSchema } from "@/lib/validation";
import { checkLeadLimit } from "@/lib/payments/domain";

async function verifyTurnstile(token: string | undefined, request: Request) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!token) return false;
  const body = new URLSearchParams({
    secret,
    response: token,
    remoteip: request.headers.get("cf-connecting-ip") ?? "",
  });
  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body, cache: "no-store" },
  );
  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  if (!(await checkRateLimit(`enquiry:${ip}`, 5, 3600)).allowed)
    return NextResponse.json(
      { error: "Too many enquiries. Try again later." },
      { status: 429 },
    );
  const parsed = enquirySubmissionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Please check the enquiry details and consent." },
      { status: 400 },
    );
  if (parsed.data.website)
    return NextResponse.json({ message: "Enquiry received." });
  if (!(await verifyTurnstile(parsed.data.turnstileToken, request)))
    return NextResponse.json(
      { error: "Please complete the verification challenge." },
      { status: 403 },
    );

  const agency = await prisma.agency.findFirst({
    where: { id: parsed.data.agencyId, status: "APPROVED" },
    select: {
      id: true,
      name: true,
      email: true,
      owner: { select: { email: true, notificationPreferences: true } },
    },
  });
  if (!agency)
    return NextResponse.json(
      { error: "This agency is not currently available." },
      { status: 404 },
    );
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);
  const [activeSubscription, leadsThisMonth, basicPlan] = await Promise.all([
    prisma.subscription.findFirst({
      where: { agencyId: agency.id, status: "ACTIVE" },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.enquiry.count({
      where: { agencyId: agency.id, createdAt: { gte: startOfMonth } },
    }),
    prisma.plan.findUnique({ where: { name: "Basic Free" } }),
  ]);
  const leadLimit =
    activeSubscription?.plan.leadLimit ?? basicPlan?.leadLimit ?? null;
  const capacity = checkLeadLimit(leadLimit, leadsThisMonth);
  if (!capacity.allowed)
    return NextResponse.json(
      {
        error:
          "This agency has reached its monthly enquiry limit. The agency can upgrade its plan to receive more leads.",
      },
      { status: 429 },
    );
  const enquiry = await prisma.enquiry.create({
    data: {
      agencyId: agency.id,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      message: parsed.data.message,
      consentGiven: true,
      source: "WEB",
      preferredStartDate: parsed.data.preferredStartDate,
      budget: parsed.data.budget,
    },
  });
  const ownerPreferences = agency.owner?.notificationPreferences;
  const shouldNotify = !(
    ownerPreferences &&
    typeof ownerPreferences === "object" &&
    "leadEmails" in ownerPreferences &&
    ownerPreferences.leadEmails === false
  );
  const emailTasks = [
    sendEmail(
      enquiry.email,
      "We received your FindMaids enquiry",
      `Your enquiry to ${agency.name} was received. The agency may contact you using the details you provided.`,
    ),
  ];
  if (shouldNotify)
    emailTasks.push(
      sendEmail(
        agency.email,
        `New enquiry for ${agency.name}`,
        `A new enquiry was received. Reference: ${enquiry.id}. Please sign in to review it.`,
      ),
    );
  const emailResults = await Promise.allSettled(emailTasks);
  for (const result of emailResults) {
    if (result.status === "rejected")
      console.error("Unable to send enquiry email", result.reason);
  }
  return NextResponse.json(
    { message: "Your enquiry has been sent." },
    { status: 201 },
  );
}
