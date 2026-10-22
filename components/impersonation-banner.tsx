"use client";

import { useEffect, useState } from "react";

export function ImpersonationBanner() {
  const [agencyId, setAgencyId] = useState<string | null>(null);
  useEffect(() => {
    void fetch("/api/agency/impersonation").then((response) => response.json()).then((result) => { if (result.active) setAgencyId(result.agencyId); }).catch(() => undefined);
  }, []);
  if (!agencyId) return null;
  async function stop() {
    const response = await fetch("/api/admin/impersonate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "stop", agencyId }) });
    if (response.ok) window.location.assign("/admin/users");
  }
  return <div role="alert" className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-[#8a4b00] px-4 py-3 text-sm font-bold text-white"><span>READ-ONLY ADMIN VIEW · Agency {agencyId}</span><button onClick={() => void stop()} className="min-h-9 rounded border border-white px-3">End view</button></div>;
}