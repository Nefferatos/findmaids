import { notFound, redirect } from "next/navigation";
import { AGENCY_PATH_BY_LEGACY_SECTION } from "@/lib/agency-menu";

/** Legacy section URLs (/agency/dashboard/profile, /maids, …) redirect to the new pages. */
export default async function LegacyAgencySectionPage({
  params,
}: {
  params: Promise<{ section: string[] }>;
}) {
  const { section } = await params;
  const key = section.join("/");
  const target = AGENCY_PATH_BY_LEGACY_SECTION[key];
  if (!target) notFound();
  redirect(target);
}
