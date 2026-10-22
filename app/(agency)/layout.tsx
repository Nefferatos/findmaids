import type { ReactNode } from "react";
import { requireRole } from "@/lib/authz";
import { ImpersonationBanner } from "@/components/impersonation-banner";
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
      {children}
    </>
  );
}
