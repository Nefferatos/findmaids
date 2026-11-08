import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, MapPin, Sparkles } from "lucide-react";
import { Container, SectionHeading } from "@/components/site";
import { demoAgencies } from "@/lib/demo-listings";
import { sampleDataEnabled } from "@/lib/sample-data";

export const metadata = {
  title: "Illustrative agency profiles | FindMaids",
  description:
    "Fictional example agency profiles demonstrating the FindMaids directory layout.",
};

export default function SampleAgenciesPage() {
  // Sample data is a local/preview tool: hide the page on any live deployment.
  if (!sampleDataEnabled()) notFound();
  return (
    <Container className="py-10 sm:py-14">
      <div className="demo-notice mb-8 rounded-2xl border p-5 sm:p-6">
        <p className="flex items-center gap-2 font-bold">
          <Sparkles aria-hidden="true" className="size-5" />
          Illustrative examples only
        </p>
        <p className="mt-2 text-sm leading-6">
          These three agency profiles are fictional design examples. They are
          not real businesses, licensed agencies, approved directory entries, or
          contactable services. No licence numbers, addresses, or phone numbers
          are shown.
        </p>
      </div>
      <SectionHeading
        eyebrow="Sample directory entries"
        title="Example agency profiles"
        description="These cards demonstrate the directory presentation only. Real agency listings are available in the approved directory."
      />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {demoAgencies.map((agency, index) => (
          <article
            key={agency.name}
            className="site-agency-card flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-sm"
          >
            <div className="from-primary/10 via-muted to-accent/20 flex items-center gap-4 border-b bg-gradient-to-br p-5">
              <div
                aria-hidden="true"
                className="border-primary/15 bg-background text-primary grid size-14 shrink-0 place-items-center rounded-2xl border"
              >
                <span className="font-display text-xl font-bold">
                  E{index + 1}
                </span>
              </div>
              <div>
                <span className="site-badge-yellow rounded-full px-3 py-1 text-xs font-bold">
                  Fictional sample
                </span>
                <h2 className="font-display mt-2 text-xl font-bold">
                  {agency.name}
                </h2>
              </div>
            </div>
            <div className="flex flex-1 flex-col p-5">
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <MapPin
                  aria-hidden="true"
                  className="text-primary size-4 shrink-0"
                />
                {agency.area}
              </p>
              <p className="text-muted-foreground mt-4 text-sm leading-6">
                {agency.description}
              </p>
              <div className="mt-5">
                <h3 className="text-xs font-bold tracking-wide uppercase">
                  Example services
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {agency.services.map((service) => (
                    <span
                      key={service}
                      className="bg-muted rounded-full px-3 py-1 text-xs font-semibold"
                    >
                      {service}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-5">
                <h3 className="text-xs font-bold tracking-wide uppercase">
                  Example nationalities served
                </h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  {agency.nationalities.join(", ")}
                </p>
              </div>
              <div className="mt-auto border-t pt-4">
                <p className="text-muted-foreground text-xs">
                  Example languages: {agency.languages.join(", ")}
                </p>
                <p className="demo-notice-text mt-2 text-xs font-bold">
                  Not a real or approved agency listing
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          href="/sample/agency-dashboard"
          className="bg-primary text-primary-foreground inline-flex min-h-11 items-center gap-2 rounded-lg px-4 font-bold"
        >
          View sample agency account
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
        <Link
          href="/sample/maids"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 font-bold"
        >
          View sample maid profiles
        </Link>
        <Link href="/agencies" className="text-primary font-bold underline">
          Browse real approved agency listings
        </Link>
      </div>
    </Container>
  );
}
