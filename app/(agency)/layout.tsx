import type { ReactNode } from "react";
import Link from "next/link";
import { requireRole } from "@/lib/authz";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { ProfileMenu } from "@/components/profile-menu";
import { auth } from "@/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyImpersonationCookie } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";

export default async function AgencyLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (session?.user.role === "AGENCY") {
    await requireRole(["AGENCY"]);
  } else if (session?.user.role === "ADMIN") {
    const cookieJar = await cookies();
    const impersonation = await verifyImpersonationCookie(
      cookieJar.get("fm-admin-impersonation")?.value,
    );
    const admin = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, disabled: true },
    });
    const agency =
      impersonation && impersonation.adminId === session.user.id
        ? await prisma.agency.findFirst({
            where: {
              id: impersonation.agencyId,
              ownerId: impersonation.userId,
            },
            select: { id: true },
          })
        : null;
    if (!admin || admin.role !== "ADMIN" || admin.disabled || !agency)
      redirect("/admin");
  } else {
    redirect("/login");
  }
  return (
    <>
      <ImpersonationBanner />
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <Link href="/agency/dashboard" className="font-display text-lg font-bold">
            FindMaids for agencies
          </Link>
          <ProfileMenu user={session.user} align="right" />
        </div>
      </div>
      {children}
    </>
  );
}
