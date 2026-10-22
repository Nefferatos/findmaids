import type { ReactNode } from "react";
import { requireRole } from "@/lib/authz";

export default async function AgencyLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole(["AGENCY"]);
  return children;
}
