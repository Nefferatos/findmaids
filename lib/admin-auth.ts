import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  adminLanding,
  canAccess,
  type AdminPermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function requireAdminPermission(permission: AdminPermission) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canAccess(session.user.role, permission))
    redirect(
      session.user.role === "STAFF"
        ? adminLanding(session.user.role)
        : "/admin/forbidden",
    );
  if (session.user.role === "ADMIN" && permission !== "twoFactor") {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { disabled: true, totpEnabled: true },
    });
    if (!user || user.disabled) redirect("/login?error=account_disabled");
    if (user.totpEnabled && !session.user.adminMfaVerified)
      redirect("/admin/2fa");
  }
  return session.user;
}

export async function authorizeAdminApi(permission: AdminPermission) {
  const session = await auth();
  if (!session?.user) return { user: null, status: 401 as const };
  if (!canAccess(session.user.role, permission))
    return { user: null, status: 403 as const };
  const account = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { disabled: true, role: true, totpEnabled: true },
  });
  if (!account || account.disabled || account.role !== session.user.role)
    return { user: null, status: 403 as const };
  if (session.user.role === "ADMIN" && permission !== "twoFactor") {
    if (account.totpEnabled && !session.user.adminMfaVerified)
      return { user: null, status: 403 as const };
  }
  return { user: session.user, status: 200 as const };
}
