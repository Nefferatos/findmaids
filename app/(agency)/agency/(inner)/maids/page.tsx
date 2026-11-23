import Link from "next/link";
import { requireOwnedAgency } from "@/lib/agency";
import { agencyMenuItem } from "@/lib/agency-menu";
import { maidPhotoUrl } from "@/lib/maid-photo";
import { prisma } from "@/lib/prisma";
import { AgencyPageHeading } from "@/components/agency/agency-page-heading";
import {
  AgencyMaidDirectory,
  type MaidDirectoryItem,
} from "@/components/agency-maid-directory";
import { AgencyMaidPagination } from "@/components/agency-maid-pagination";
import {
  maidDirectoryHref,
  maidDirectoryPage,
  maidDirectoryWhere,
  parseMaidDirectoryParams,
  type MaidDirectoryStatus,
} from "@/lib/maid-directory";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Edit/Delete Maids | FindMaids",
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;

const HEADINGS: Record<MaidDirectoryStatus, string> = {
  hidden: "Maids Hidden",
  published: "Maids Published",
  all: "All Maids",
};

const DESCRIPTIONS: Record<MaidDirectoryStatus, string> = {
  hidden:
    "Profiles that are not shown on your public agency page. Publish one when it is ready, or delete profiles you no longer offer.",
  published:
    "Profiles currently visible on your public agency page and in the maid directory.",
  all: "Every maid profile in your agency, published or hidden.",
};

const dateLabel = new Intl.DateTimeFormat("en-SG", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

export default async function AgencyMaidsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { agency, readOnly } = await requireOwnedAgency();
  const query = parseMaidDirectoryParams(await searchParams);
  const where = maidDirectoryWhere(agency.id, query);

  // Counts drive the tabs and the summary; only one page of cards is loaded.
  const [total, publishedCount, hiddenCount] = await Promise.all([
    prisma.maid.count({ where }),
    prisma.maid.count({ where: { agencyId: agency.id, published: true } }),
    prisma.maid.count({ where: { agencyId: agency.id, published: false } }),
  ]);
  const range = maidDirectoryPage(total, query.page);

  const rows = await prisma.maid.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    skip: range.skip,
    take: range.take,
    select: {
      id: true,
      reference: true,
      fullName: true,
      nationality: true,
      placementType: true,
      status: true,
      published: true,
      photoUrl: true,
      photoUrls: true,
      updatedAt: true,
    },
  });

  const items: MaidDirectoryItem[] = rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    fullName: row.fullName,
    nationality: row.nationality,
    placementType: row.placementType,
    status: row.status,
    published: row.published,
    photoUrl: maidPhotoUrl(row),
    photoCount: row.photoUrls.length,
    updatedLabel: dateLabel.format(row.updatedAt),
  }));

  const totalAll = publishedCount + hiddenCount;
  const tabs: { status: MaidDirectoryStatus; label: string; count: number }[] =
    [
      { status: "hidden", label: "Hidden", count: hiddenCount },
      { status: "published", label: "Published", count: publishedCount },
      { status: "all", label: "All", count: totalAll },
    ];
  const scopeLabel = query.status === "all" ? "maid " : `${query.status} maid `;

  return (
    <AgencyPageHeading
      item={agencyMenuItem("manage-maids")}
      title={HEADINGS[query.status]}
      description={DESCRIPTIONS[query.status]}
    >
      <nav className="ag-maid-tabs" aria-label="Profile visibility">
        {tabs.map((tab) => (
          <Link
            key={tab.status}
            href={maidDirectoryHref({ q: query.q, status: tab.status })}
            aria-current={query.status === tab.status ? "page" : undefined}
          >
            {tab.label}
            <span className="ag-maid-tab-count">{tab.count}</span>
          </Link>
        ))}
      </nav>

      <form
        className="ag-maid-search"
        method="get"
        action="/agency/maids"
        role="search"
      >
        {query.status === "hidden" ? null : (
          <input type="hidden" name="status" value={query.status} />
        )}
        <label htmlFor="maid-directory-q">Maid name or code</label>
        <input
          id="maid-directory-q"
          name="q"
          type="search"
          defaultValue={query.q}
          placeholder="Maid name or code"
          maxLength={80}
          autoComplete="off"
        />
        <button type="submit">Search</button>
        {query.q ? (
          <Link
            className="ag-maid-clear"
            href={maidDirectoryHref({ status: query.status })}
          >
            Clear
          </Link>
        ) : null}
      </form>

      <p className="ag-maid-summary" role="status" aria-live="polite">
        {total === 0 ? (
          query.q ? (
            <>No maid profiles match “{query.q}”.</>
          ) : (
            <>No {scopeLabel}profiles in this view.</>
          )
        ) : (
          <>
            Showing <strong>{range.from}</strong>–<strong>{range.to}</strong> of{" "}
            <strong>{total}</strong> {scopeLabel}
            {total === 1 ? "profile" : "profiles"}
            {query.q ? <> matching “{query.q}”</> : null}
            {range.pages > 1 ? (
              <>
                {" "}
                · page {range.page} of {range.pages}
              </>
            ) : null}
          </>
        )}
      </p>

      <AgencyMaidPagination
        page={range.page}
        pages={range.pages}
        q={query.q}
        status={query.status}
      />

      {total === 0 ? (
        <div className="ag-maid-empty">
          <h2>
            {query.q
              ? "No matching profiles"
              : totalAll === 0
                ? "No maid profiles yet"
                : "Nothing in this view"}
          </h2>
          <p>
            {query.q
              ? "Try a different name or reference code, or clear the search."
              : totalAll === 0
                ? "Add your first maid profile to start building your public listing."
                : "Switch tabs above to see your other profiles."}
          </p>
          {query.q ? (
            <Link
              className="ag-btn"
              href={maidDirectoryHref({ status: query.status })}
            >
              Clear search
            </Link>
          ) : (
            <Link className="ag-btn" href="/agency/maids/new">
              Add a maid
            </Link>
          )}
        </div>
      ) : (
        <AgencyMaidDirectory
          items={items}
          agencyName={agency.name}
          readOnly={readOnly}
        />
      )}

      <AgencyMaidPagination
        page={range.page}
        pages={range.pages}
        q={query.q}
        status={query.status}
      />

      <p className="ag-maid-note">
        {plural(totalAll, "profile")} in your agency ·{" "}
        {plural(hiddenCount, "hidden")} · {plural(publishedCount, "published")}
      </p>
    </AgencyPageHeading>
  );
}
