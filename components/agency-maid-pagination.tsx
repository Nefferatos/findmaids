import Link from "next/link";
import {
  maidDirectoryHref,
  type MaidDirectoryStatus,
} from "@/lib/maid-directory";

/**
 * Numbered pager for the Edit/Delete Maids directory. Links keep the active
 * search term and status, so paging never drops the filter.
 */
export function AgencyMaidPagination({
  page,
  pages,
  q,
  status,
}: {
  page: number;
  pages: number;
  q: string;
  status: MaidDirectoryStatus;
}) {
  if (pages <= 1) return null;

  const visible = Array.from({ length: pages }, (_, index) => index + 1).filter(
    (number) =>
      number === 1 || number === pages || Math.abs(number - page) <= 2,
  );
  const nodes: (number | "gap")[] = [];
  for (const [index, number] of visible.entries()) {
    const previous = visible[index - 1];
    if (previous !== undefined && number - previous > 1) nodes.push("gap");
    nodes.push(number);
  }

  return (
    <nav className="ag-pager" aria-label="Maid pages">
      {page > 1 ? (
        <Link
          href={maidDirectoryHref({ q, status, page: page - 1 })}
          rel="prev"
        >
          Previous
        </Link>
      ) : (
        <span className="ag-pager-disabled">Previous</span>
      )}
      {nodes.map((node, index) =>
        node === "gap" ? (
          <span
            key={`gap-${index}`}
            className="ag-pager-gap"
            aria-hidden="true"
          >
            …
          </span>
        ) : (
          <Link
            key={node}
            href={maidDirectoryHref({ q, status, page: node })}
            aria-current={node === page ? "page" : undefined}
          >
            {node}
          </Link>
        ),
      )}
      {page < pages ? (
        <Link
          href={maidDirectoryHref({ q, status, page: page + 1 })}
          rel="next"
        >
          Next
        </Link>
      ) : (
        <span className="ag-pager-disabled">Next</span>
      )}
    </nav>
  );
}
