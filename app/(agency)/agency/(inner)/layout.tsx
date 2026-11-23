import type { ReactNode } from "react";
import { requireOwnedAgency } from "@/lib/agency";
import { SHOW_NAV_ON_SUBPAGES } from "@/lib/agency-menu";
import { AgencyHeader } from "@/components/agency/agency-header";
import { AgencyNav } from "@/components/agency/agency-nav";
import { AgencyStatusNotice } from "@/components/agency/agency-status-notice";

/** Inner layout: slim navy header only (nav bar opt-in via config). */
export default async function AgencyInnerLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { agency } = await requireOwnedAgency();

  return (
    <div className="agency-app">
      <div className="ag-frame">
        <AgencyHeader />
        {SHOW_NAV_ON_SUBPAGES ? <AgencyNav /> : null}
        {agency.status !== "APPROVED" ? (
          <AgencyStatusNotice status={agency.status} />
        ) : null}
        <main className="ag-inner">{children}</main>
      </div>
    </div>
  );
}
