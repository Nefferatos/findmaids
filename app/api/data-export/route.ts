import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { cookies } from "next/headers";
import {
  chatCookieName,
  hashVisitorToken,
  verifyVisitorCookie,
} from "@/lib/ai/chat-session";

export async function GET() {
  const session = await auth();
  const jar = await cookies();
  const visitorToken = verifyVisitorCookie(jar.get(chatCookieName)?.value);
  if (!session?.user?.id && !visitorToken)
    return NextResponse.json(
      {
        error: "Sign in or continue the verified chat session to export data.",
      },
      { status: 401 },
    );
  const ownerKey = session?.user?.id ?? hashVisitorToken(visitorToken!);
  if (!(await checkRateLimit(`data-export:${ownerKey}`, 3, 86_400)).allowed)
    return NextResponse.json(
      { error: "Export limit reached." },
      { status: 429 },
    );

  const [user, enquiries, reviews, conversations, cookieConsents] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: session?.user?.id ?? "" },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          agencies: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.enquiry.findMany({
        where: { email: session?.user?.email ?? "" },
        select: {
          id: true,
          agencyId: true,
          name: true,
          email: true,
          phone: true,
          message: true,
          preferredStartDate: true,
          budget: true,
          status: true,
          consentAt: true,
          consentPolicyVersion: true,
          createdAt: true,
          anonymizedAt: true,
        },
        take: 1000,
      }),
      prisma.review.findMany({
        where: { reviewerEmail: session?.user?.email ?? "" },
        select: {
          id: true,
          agencyId: true,
          rating: true,
          title: true,
          body: true,
          status: true,
          createdAt: true,
        },
        take: 1000,
      }),
      prisma.conversation.findMany({
        where: visitorToken
          ? {
              OR: [
                { userId: session?.user?.id ?? "" },
                { visitorTokenHash: hashVisitorToken(visitorToken) },
              ],
            }
          : { userId: session?.user?.id ?? "" },
        select: {
          id: true,
          channel: true,
          status: true,
          createdAt: true,
          messages: {
            select: { role: true, content: true, createdAt: true },
            take: 500,
          },
        },
        take: 200,
      }),
      prisma.cookieConsent.findMany({
        where: { userId: session?.user?.id ?? "" },
        select: { policyVersion: true, analytics: true, capturedAt: true },
        take: 100,
      }),
    ]);
  if (session?.user?.id && !user)
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  return NextResponse.json(
    {
      exportedAt: new Date().toISOString(),
      user,
      enquiries,
      reviews,
      conversations,
      cookieConsents,
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition":
          "attachment; filename=findmaids-data-export.json",
      },
    },
  );
}
