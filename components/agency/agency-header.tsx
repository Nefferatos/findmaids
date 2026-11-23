"use client";

import Link from "next/link";
import { useState } from "react";
import { signOut } from "next-auth/react";

/** Navy header: title, Log Out text button and the red X button. */
export function AgencyHeader({ slim = false }: { slim?: boolean }) {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <header className="ag-header" data-slim={slim ? "true" : undefined}>
      <Link href="/agency" className="ag-title">
        Maid Agency Account Management
      </Link>
      <div className="ag-header-actions">
        <button
          type="button"
          onClick={() => void handleSignOut()}
          disabled={signingOut}
          className="ag-logout"
        >
          {signingOut ? "Logging out…" : "Log Out"}
        </button>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          disabled={signingOut}
          aria-label="Log out"
          className="ag-x"
        >
          ✕
        </button>
      </div>
    </header>
  );
}
