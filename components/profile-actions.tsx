"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

export function TrackedLink({
  agencyId,
  eventType,
  href,
  children,
  className,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  agencyId: string;
  eventType: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={() => {
        void fetch("/api/analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agencyId, type: eventType }),
        });
      }}
      {...props}
    >
      {children}
    </a>
  );
}

export function ShareButton({ title }: { title: string }) {
  const [message, setMessage] = useState("");
  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        setMessage("Link copied.");
      }
    } catch {
      setMessage("Unable to share this link.");
    }
  }
  return (
    <div>
      <button
        type="button"
        onClick={share}
        className="hover:bg-muted inline-flex min-h-10 items-center gap-2 rounded-md border bg-white px-3 font-semibold"
      >
        <Share2 aria-hidden="true" className="size-4" />
        Share
      </button>
      {message && (
        <span role="status" className="text-muted-foreground ml-2 text-sm">
          {message}
        </span>
      )}
    </div>
  );
}
