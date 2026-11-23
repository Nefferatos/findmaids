import { redirect } from "next/navigation";

/** Legacy portal URL: send old bookmarks/links to the new launcher. */
export default function LegacyAgencyDashboardPage() {
  redirect("/agency");
}
