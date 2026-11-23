"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MORE_ITEMS, NAV_ITEMS } from "@/lib/agency-menu";

/** Grey nav strip: HOME + section links + the MORE dropdown. */
export function AgencyNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const more = useRef<HTMLDivElement | null>(null);
  const moreActive = MORE_ITEMS.some((item) => item.path === pathname);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (more.current && !more.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <nav className="ag-nav" aria-label="Agency portal">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.id}
          href={item.path}
          className={pathname === item.path ? "active" : undefined}
          aria-current={pathname === item.path ? "page" : undefined}
        >
          {item.navLabel}
        </Link>
      ))}
      <div className="ag-more" data-open={open ? "true" : "false"} ref={more}>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="agency-more-menu"
          aria-label="More agency pages"
          className={moreActive ? "active" : undefined}
        >
          MORE ▾
        </button>
        <div className="ag-more-menu" id="agency-more-menu">
          {MORE_ITEMS.map((item) => (
            <Link
              key={item.id}
              href={item.path}
              onClick={() => setOpen(false)}
              aria-current={pathname === item.path ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
