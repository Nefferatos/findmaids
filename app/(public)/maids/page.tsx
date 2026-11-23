import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The search form and results now live together on `/maids/search`. Older
 * links, bookmarks and form submissions that target `/maids` keep working by
 * forwarding the query string to the combined page.
 */
export default async function MaidResultsRedirect({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value) query.append(key, value);
  }
  const search = query.toString();
  redirect(search ? `/maids/search?${search}` : "/maids/search");
}
