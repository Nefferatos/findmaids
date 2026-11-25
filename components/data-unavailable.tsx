import Link from "next/link";
import { Container } from "@/components/site";

/**
 * Shown when a page could not read the database.
 *
 * Detail pages used to `.catch(() => null)` and then call `notFound()`, so a
 * Postgres/Hyperdrive connection timeout (which is what caused the live 404s on
 * real maid and agency profiles) was reported to visitors and search engines as
 * "this page does not exist". A failed query is not a missing record: this state
 * says the data is temporarily unavailable, and asks the visitor to retry
 * instead of pretending the listing was removed.
 */
export function DataUnavailable({
  title,
  detail,
  backHref = "/agencies",
  backLabel = "Browse approved agencies",
}: {
  title: string;
  detail?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <Container className="py-12">
      <div className="mx-auto max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center sm:p-8">
        <p className="text-primary text-xs font-extrabold tracking-[0.14em] uppercase">
          Temporarily unavailable
        </p>
        <h1 className="font-display mt-2 text-2xl font-bold tracking-tight">
          {title}
        </h1>
        <p className="text-muted-foreground mt-3 text-sm leading-6">
          {detail ??
            "We could not load this record just now. Nothing has been removed - the database did not respond in time. Please reload the page in a moment."}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={backHref}
            className="bg-primary text-primary-foreground inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-bold"
          >
            {backLabel}
          </Link>
          <Link href="/contact" className="inline-flex min-h-11 items-center rounded-lg border border-[var(--border)] px-4 text-sm font-bold">
            Contact us
          </Link>
        </div>
      </div>
    </Container>
  );
}
