import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { auth } from "@/auth";

export async function requireRole(roles: UserRole[]) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!roles.includes(session.user.role))
    redirect(session.user.role === "ADMIN" ? "/admin" : "/agency/dashboard");
  return session.user;
}
