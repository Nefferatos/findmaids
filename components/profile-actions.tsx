"use client";

import { useEffect, useRef, useState } from "react";
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
        if (eventType === "placement_click") {
          const key = `placement-click:${agencyId}`;
          const lastClick = Number(sessionStorage.getItem(key) ?? 0);
          if (Date.now() - lastClick < 1000) return;
          sessionStorage.setItem(key, String(Date.now()));
        }
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

export function PlacementImpression({ agencyIds }: { agencyIds: string[] }) {
  const uniqueAgencyIds = [...new Set(agencyIds)];
  return (
    <>
      {uniqueAgencyIds.filter(Boolean).map((agencyId) => (
        <ImpressionOnce key={agencyId} agencyId={agencyId} />
      ))}
    </>
  );
}

function ImpressionOnce({ agencyId }: { agencyId: string }) {
  const [seen, setSeen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current || seen) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setSeen(true);
        void fetch("/api/analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agencyId, type: "placement_impression" }),
          keepalive: true,
        });
        observer.disconnect();
      },
      { threshold: 0.5 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [agencyId, seen]);
  return <span ref={ref} className="block h-px w-full" aria-hidden="true" />;
}
