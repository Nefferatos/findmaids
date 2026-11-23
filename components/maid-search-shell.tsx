"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SlidersHorizontal, X } from "lucide-react";

/**
 * Two-column explorer: filter sidebar on the left, results on the right.
 *
 * On mobile the same sidebar becomes a drawer opened from the Filters button,
 * with the active-filter count on the button. The filter form dispatches
 * `fm:close-filters` after applying so the drawer closes without coupling the
 * two components.
 */
export function MaidSearchShell({
  filters,
  results,
  activeCount,
}: {
  filters: ReactNode;
  results: ReactNode;
  activeCount: number;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const close = () => setOpen(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("fm:close-filters", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("fm:close-filters", close);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // Move focus into the drawer while it is open, and restore it on close.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      panelRef.current
        ?.querySelector<HTMLButtonElement>(".fm-filter-panel-close")
        ?.focus();
    } else if (wasOpen.current) {
      wasOpen.current = false;
      buttonRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <div
      className={["fm-explorer-layout", open ? "is-filters-open" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      {open && (
        <button
          type="button"
          className="fm-filter-backdrop"
          aria-label="Close filters"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        ref={panelRef}
        id="maid-filters"
        className="fm-filter-panel"
        aria-label="Maid filters"
      >
        <div className="fm-filter-panel-head">
          <p>Filters</p>
          <button
            type="button"
            className="fm-filter-panel-close"
            aria-label="Close filters"
            onClick={() => setOpen(false)}
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
        {filters}
      </aside>

      <section className="fm-results-main" aria-label="Maid results">
        <div className="fm-mobile-filter-bar">
          <button
            ref={buttonRef}
            type="button"
            className="fm-filter-button"
            aria-expanded={open}
            aria-controls="maid-filters"
            onClick={() => setOpen(true)}
          >
            <SlidersHorizontal aria-hidden="true" className="size-4" />
            <span>Filters</span>
            {activeCount > 0 && (
              <span className="fm-filter-button-count">{activeCount}</span>
            )}
          </button>
        </div>
        {results}
      </section>
    </div>
  );
}
