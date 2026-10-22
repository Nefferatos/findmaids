"use client";

import { useEffect } from "react";

export function ProfileViewTracker({ agencyId }: { agencyId: string }) {
  useEffect(() => {
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agencyId, type: "profile_view" }),
      keepalive: true,
    });
  }, [agencyId]);
  return null;
}
