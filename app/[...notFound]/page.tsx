import { notFound } from "next/navigation";

/**
 * Catch-all for unknown paths.
 *
 * The prerendered `/_not-found` route is served by OpenNext's static path, which
 * fails on Workers ("this promise was created by a request that has since
 * ended"), so every unmatched URL returned Error 1101 instead of the 404 page.
 * This dynamic catch-all renders the not-found UI inside the request instead.
 * Known routes are matched before it, so it only sees genuinely unknown paths.
 */
export const dynamic = "force-dynamic";

export default function UnknownRoute(): never {
  notFound();
}
