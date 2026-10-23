"use client";

import { useEffect } from "react";

export function ProfileViewTracker({ agencyId }: { agencyId: string }) {
  useEffect(() => {
    if (localStorage.getItem("findmaids-cookie-consent") !== "analytics-v1")
      return;
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agencyId, type: "profile_view" }),
      keepalive: true,
    });
  }, [agencyId]);
  return null;
}
