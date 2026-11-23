"use client";

import { useRouter } from "next/navigation";
import { MAID_SORT_OPTIONS } from "@/lib/maid-search-options";

/**
 * Sort control for the results toolbar. Keeps the current filters and updates
 * the URL, which re-runs the existing server-side search.
 */
export function MaidSortSelect({
  value,
  baseQuery,
}: {
  value: string;
  /** Current filter query string (without the page). */
  baseQuery: string;
}) {
  const router = useRouter();

  return (
    <label className="fm-sort-control">
      <span>Sort by</span>
      <select
        value={value}
        onChange={(event) => {
          const params = new URLSearchParams(baseQuery);
          if (event.target.value === "newest") params.delete("sort");
          else params.set("sort", event.target.value);
          const query = params.toString();
          router.push(query ? `/maids/search?${query}` : "/maids/search", {
            scroll: false,
          });
        }}
      >
        {MAID_SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
