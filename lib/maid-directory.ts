import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Query rules for the agency "Edit/Delete Maids" directory.
 *
 * The directory is server-paginated so an agency with hundreds of profiles is
 * browsable: only one page of cards is ever rendered, and the counts come from
 * `count()` instead of loading every row.
 */
export const MAID_DIRECTORY_PAGE_SIZE = 20;

export type MaidDirectoryStatus = "hidden" | "published" | "all";

export type MaidDirectoryQuery = {
  q: string;
  status: MaidDirectoryStatus;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

/** "Maids Hidden" is the default view, matching the portal's history. */
export function parseMaidDirectoryParams(
  params: RawParams,
): MaidDirectoryQuery {
  const statusRaw = first(params.status).trim().toLowerCase();
  const status: MaidDirectoryStatus =
    statusRaw === "published" || statusRaw === "all" ? statusRaw : "hidden";
  const pageRaw = Number(first(params.page));
  const page =
    Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  return { q: first(params.q).trim().slice(0, 80), status, page };
}

/**
 * Agency id is always part of the filter, so no query can ever reach another
 * agency's profiles. `q` searches the reference code and the maid name.
 */
export function maidDirectoryWhere(
  agencyId: string,
  query: Pick<MaidDirectoryQuery, "q" | "status">,
): Prisma.MaidWhereInput {
  const where: Prisma.MaidWhereInput = { agencyId };
  if (query.status === "published") where.published = true;
  if (query.status === "hidden") where.published = false;
  if (query.q) {
    where.OR = [
      { reference: { contains: query.q, mode: "insensitive" } },
      { fullName: { contains: query.q, mode: "insensitive" } },
    ];
  }
  return where;
}

/** Clamps the requested page to the real range and returns skip/take + labels. */
export function maidDirectoryPage(total: number, requested: number) {
  const pages = Math.max(1, Math.ceil(total / MAID_DIRECTORY_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(requested) || 1), pages);
  const skip = (page - 1) * MAID_DIRECTORY_PAGE_SIZE;
  return {
    page,
    pages,
    skip,
    take: MAID_DIRECTORY_PAGE_SIZE,
    from: total === 0 ? 0 : skip + 1,
    to: Math.min(total, skip + MAID_DIRECTORY_PAGE_SIZE),
  };
}

/** Keeps the search term and status when moving between pages. */
export function maidDirectoryHref(query: {
  q?: string;
  status?: MaidDirectoryStatus;
  page?: number;
}) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.status && query.status !== "hidden")
    params.set("status", query.status);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  const search = params.toString();
  return search ? `/agency/maids?${search}` : "/agency/maids";
}
