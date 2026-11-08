import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Languages, MapPin, Sparkles } from "lucide-react";
import { Container, SectionHeading } from "@/components/site";
import { demoMaidProfiles } from "@/lib/demo-listings";
import { sampleDataEnabled } from "@/lib/sample-data";

export const metadata = {
  title: "Illustrative maid profiles | FindMaids",
  description:
    "Fictional example profiles demonstrating how maid listings could appear.",
};

export default function SampleMaidsPage() {
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
          These five profiles are fictional layout examples. They are not real
          people, available workers, or database listings. Details and images
          have not been verified; no real person photos or contact information
          are shown.
        </p>
      </div>
      <SectionHeading
        eyebrow="Sample listings"
        title="Example maid profiles"
        description="A preview of the kind of profile information a future listing may contain."
      />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {demoMaidProfiles.map((profile) => (
          <article
            key={profile.reference}
            className="site-agency-card flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-sm"
          >
            <div className="bg-muted/60 flex items-center gap-4 border-b p-5">
              <div
                aria-hidden="true"
                className="border-primary/15 bg-background text-primary grid size-16 shrink-0 place-items-center rounded-2xl border"
              >
                <span className="font-display text-xl font-bold">
                  {profile.reference.slice(-2)}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-primary text-xs font-bold tracking-wide uppercase">
                  Fictional sample
                </p>
                <h2 className="font-display mt-1 text-xl font-bold">
                  Example profile {profile.reference.slice(-2)}
                </h2>
                <p className="text-muted-foreground mt-1 text-xs">
                  Ref. {profile.reference}
                </p>
              </div>
            </div>
            <div className="flex flex-1 flex-col p-5">
              <div className="flex flex-wrap gap-2">
                <span className="site-badge-green rounded-full px-3 py-1 text-xs font-bold">
                  {profile.nationality}
                </span>
                <span className="site-badge-yellow rounded-full px-3 py-1 text-xs font-bold">
                  {profile.placementType}
                </span>
                <span className="bg-muted rounded-full px-3 py-1 text-xs font-bold">
                  Age {profile.age}
                </span>
              </div>
              <div className="mt-5 space-y-4">
                <div>
                  <h3 className="text-xs font-bold tracking-wide uppercase">
                    Languages
                  </h3>
                  <p className="text-muted-foreground mt-1 flex items-start gap-2 text-sm">
                    <Languages
                      aria-hidden="true"
                      className="text-primary mt-0.5 size-4 shrink-0"
                    />
                    {profile.languages.join(", ")}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-bold tracking-wide uppercase">
                    Example duties
                  </h3>
                  <ul className="text-muted-foreground mt-1 list-inside list-disc space-y-1 text-sm">
                    {profile.duties.map((duty) => (
                      <li key={duty}>{duty}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="text-muted-foreground mt-auto border-t pt-4 text-sm">
                <span className="text-foreground font-semibold">
                  Example agency:
                </span>{" "}
                {profile.agency}
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
          href="/sample/agencies"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 font-bold"
        >
          View sample agencies
        </Link>
        <Link href="/agencies" className="text-primary font-bold underline">
          Browse real approved agency listings
        </Link>
      </div>
      <p className="text-muted-foreground mt-4 flex items-center gap-2 text-xs">
        <MapPin aria-hidden="true" className="size-3.5" />
        Any Singapore locations elsewhere on this site refer to real directory
        context, not to these fictional profiles.
      </p>
    </Container>
  );
}
