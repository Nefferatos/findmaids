import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { cookies } from "next/headers";
import { verifyImpersonationCookie } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";

export async function requireOwnedAgency() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "ADMIN") {
    const cookieJar = await cookies();
    const impersonation = await verifyImpersonationCookie(
      cookieJar.get("fm-admin-impersonation")?.value,
    );
    if (impersonation && impersonation.adminId === session.user.id) {
      const agency = await prisma.agency.findFirst({
        where: { id: impersonation.agencyId, ownerId: impersonation.userId },
      });
      if (agency)
        return { user: session.user, agency, readOnly: true as const };
    }
    redirect("/admin");
  }
  if (session.user.role !== "AGENCY") redirect("/");
  const agency = await prisma.agency.findUnique({
    where: { ownerId: session.user.id },
  });
  if (!agency) redirect("/agency/onboarding");
  return { user: session.user, agency, readOnly: false as const };
}

export function calculateProfileCompleteness(profile: {
  name?: string | null;
  description?: string | null;
  yearEstablished?: number | null;
  licenseNumber?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  website?: string | null;
  services?: string[];
  nationalitiesServed?: string[];
  languages?: string[];
  logoUrl?: string | null;
  bannerUrl?: string | null;
  photos?: unknown[];
}) {
  const values = [
    profile.name,
    profile.description,
    profile.yearEstablished,
    profile.licenseNumber,
    profile.address,
    profile.city,
    profile.province,
    profile.phone,
    profile.whatsapp,
    profile.email,
    profile.website,
    profile.services?.length,
    profile.nationalitiesServed?.length,
    profile.languages?.length,
    profile.logoUrl,
    profile.bannerUrl,
    profile.photos?.length,
  ];
  return Math.round((values.filter(Boolean).length / values.length) * 100);
}
