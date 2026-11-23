import { redirect } from "next/navigation";
import type { UserRole } from "@/lib/generated/prisma/client";
import { auth } from "@/auth";

export async function requireRole(roles: UserRole[]) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!roles.includes(session.user.role)) {
    if (session.user.role === "ADMIN") redirect("/admin");
    if (session.user.role === "AGENCY") redirect("/agency");
    redirect("/account");
  }
  return session.user;
}
