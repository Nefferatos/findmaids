"use client";

import type { ReactNode } from "react";

/**
 * Opens the existing "Submit your requirements" enquiry panel
 * (`ContactAgencyTab`) from anywhere on the page by broadcasting a window
 * event. Keeps every "Request maid" / "Submit requirements" button wired to the
 * same form instead of duplicating it.
 */
export function RequestMaidButton({
  children = "Request maid",
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        window.dispatchEvent(new Event("findmaids:open-contact"));
      }}
    >
      {children}
    </button>
  );
}
