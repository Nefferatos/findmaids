import type { ReactNode } from "react";
import { requireOwnedAgency } from "@/lib/agency";
import { AgencyHeader } from "@/components/agency/agency-header";
import { AgencyNav } from "@/components/agency/agency-nav";
import { AgencyStatusNotice } from "@/components/agency/agency-status-notice";

/** Home layout: navy header + grey nav bar, content directly on white. */
export default async function AgencyHomeLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { agency } = await requireOwnedAgency();

  return (
    <div className="agency-app">
      <div className="ag-frame">
        <AgencyHeader />
        <AgencyNav />
        {agency.status !== "APPROVED" ? (
          <AgencyStatusNotice status={agency.status} />
        ) : null}
        <main className="ag-home">{children}</main>
      </div>
    </div>
  );
}
