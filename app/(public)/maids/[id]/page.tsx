import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ArrowLeft, Check, Languages, MapPin } from "lucide-react";
import { Container } from "@/components/site";
import { DataUnavailable } from "@/components/data-unavailable";
import { EnquiryForm } from "@/components/forms";
import { MaidPhoto } from "@/components/maid-photo";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { maidPhotoUrl } from "@/lib/maid-photo";
import { ageFromDateOfBirth } from "@/lib/maid-profile";
import { maidStatusLabels, publishedMaidWhere } from "@/lib/maids";
import { sampleAgencyVisibilityWhere } from "@/lib/sample-data";

// Maid profiles are rendered per request so agency edits and takedowns apply
// immediately.
export const dynamic = "force-dynamic";

function maidName(maid: { fullName: string | null; reference: string }) {
  return maid.fullName?.trim() || `Maid ${maid.reference}`;
}

/** Maids store values such as "Filipino maid"; avoid "Filipino maid maid". */
function maidNationalityLabel(nationality: string) {
  const value = nationality.trim();
  if (!value) return "Maid";
  return /maid$/i.test(value) ? value : `${value} maid`;
}

function maidPhoto(maid: {
  photoPortraitUrls: string[];
  photoUrl: string | null;
  photoUrls: string[];
  photoThumbnailUrls: string[];
}) {
  // Legacy `/uploads/...` paths are rejected here, so the page shows the
  // initials placeholder instead of a broken image.
  return maidPhotoUrl(maid);
}

function maidWhere(id: string) {
  const visibility = sampleAgencyVisibilityWhere();
  return {
    id,
    ...publishedMaidWhere(),
    agency: {
      status: "APPROVED" as const,
      ...(visibility ? { AND: [visibility] } : {}),
    },
  };
}

/**
 * `generateMetadata` and the page body need the same row, so the query is
 * memoised per request: one socket/database round trip instead of two, which
 * matters on the Workers CPU budget.
 */
const loadMaid = cache((id: string) =>
  prisma.maid.findFirst({
    where: maidWhere(id),
    include: {
      agency: {
        select: {
          id: true,
          name: true,
          slug: true,
          city: true,
          province: true,
          verifiedBadge: true,
        },
      },
    },
  }),
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let maid: Awaited<ReturnType<typeof loadMaid>> = null;
  let loadFailed = false;
  try {
    maid = await loadMaid(id);
  } catch {
    // A timeout says nothing about whether the profile exists, so leave the
    // page indexable instead of marking it "not found".
    loadFailed = true;
  }
  if (loadFailed) return { title: "Maid profile | FindMaids" };
  // Answer a genuinely unknown id with a real 404 before rendering starts;
  // notFound() from the page body can arrive after the shell has streamed,
  // which leaves the response at 200.
  if (!maid) notFound();
  const name = maidName(maid);
  return {
    title: `${name} | FindMaids`,
    description: `${name} — ${maidNationalityLabel(maid.nationality)} profile published by an approved Singapore agency.`,
  };
}

export default async function MaidProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let maid: Awaited<ReturnType<typeof loadMaid>> = null;
  let loadFailed = false;
  try {
    maid = await loadMaid(id);
  } catch (error) {
    loadFailed = true;
    logger.error(
      {
        errorType: error instanceof Error ? error.name : "unknown",
        reason: error instanceof Error ? error.message : "unknown",
        maidId: id,
      },
      "Unable to load maid profile",
    );
  }
  // A failed query is not a missing profile: never answer a database timeout
  // with 404, which used to make real listings look deleted.
  if (loadFailed)
    return (
      <DataUnavailable
        title="This maid profile could not be loaded"
        detail="The database did not answer in time, so the profile is not shown. The listing has not been removed - please reload in a moment."
        backHref="/maids/search"
        backLabel="Back to maid search"
      />
    );
  if (!maid || !maid.agency) notFound();

  const name = maidName(maid);
  const nationalityLabel = maidNationalityLabel(maid.nationality);
  const photo = maidPhoto(maid);
  const agencyHref = `/agencies/${maid.agency.slug}`;
  const duties = maid.duties ?? [];
  const languages = maid.languages ?? [];
  // Agencies quote either an expected salary or a listed monthly rate.
  const salary = maid.expectedSalary ?? maid.monthlySalary ?? null;

  // The age column is often empty on imported profiles; derive it from the
  // birth date so the profile shows the same age as the listing card.
  const age = maid.age ?? ageFromDateOfBirth(maid.dateOfBirth);
  const facts: { label: string; value: string }[] = [
    { label: "Nationality", value: maid.nationality },
    { label: "Age", value: age ? `${age}` : "Ask agency" },
    { label: "Maid type", value: maid.placementType || "Ask agency" },
    {
      label: "Experience",
      value: maid.experienceYears
        ? `${maid.experienceYears} years`
        : "Ask agency",
    },
    {
      label: "Languages",
      value: languages.length ? languages.join(", ") : "Ask agency",
    },
    {
      label: "Salary",
      value: salary ? `S$${salary}/month` : "Ask agency",
    },
    { label: "Reference", value: maid.reference },
    { label: "Status", value: maidStatusLabels[maid.status] },
  ];

  return (
    <Container className="py-8 sm:py-12">
      <Link
        href="/#maids-by-nationality"
        className="text-primary inline-flex items-center gap-1 text-sm font-bold hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to maid listings
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="site-agency-card overflow-hidden rounded-2xl border bg-white">
          <div className="bg-muted relative aspect-[3/4]">
            <MaidPhoto
              src={photo}
              name={name}
              priority
              className="object-cover object-top"
              placeholderClassName="text-primary font-display grid size-full place-items-center text-4xl font-bold"
            />
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-primary text-xs font-extrabold tracking-[0.14em] uppercase">
            {nationalityLabel} profile
          </p>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            {name}
          </h1>
          <p className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1">
              <MapPin aria-hidden="true" className="size-4" />
              {maid.agency.city}, {maid.agency.province}
            </span>
            <span className="inline-flex items-center gap-1">
              <Languages aria-hidden="true" className="size-4" />
              {languages.length ? languages.join(", ") : "Languages on request"}
            </span>
          </p>

          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {facts.map((fact) => (
              <div
                key={fact.label}
                className="rounded-xl border border-[var(--border)] bg-white p-3"
              >
                <dt className="text-muted-foreground text-[0.66rem] font-bold tracking-wide uppercase">
                  {fact.label}
                </dt>
                <dd className="mt-0.5 text-sm font-semibold">{fact.value}</dd>
              </div>
            ))}
          </dl>

          {duties.length > 0 && (
            <section className="mt-8">
              <h2 className="font-display text-xl font-bold">
                Duties and experience
              </h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {duties.map((duty) => (
                  <li
                    key={duty}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--muted)] px-3 py-1 text-xs font-semibold"
                  >
                    <Check aria-hidden="true" className="text-primary size-3" />
                    {duty}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {maid.introduction && (
            <section className="mt-8">
              <h2 className="font-display text-xl font-bold">
                About this profile
              </h2>
              <p className="text-muted-foreground mt-2 text-sm leading-6 whitespace-pre-line">
                {maid.introduction}
              </p>
            </section>
          )}

          <section className="mt-8 rounded-2xl border border-[var(--border)] bg-white p-5">
            <h2 className="font-display text-xl font-bold">
              Published by {maid.agency.name}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {maid.agency.verifiedBadge
                ? "Approved and verified agency profile on FindMaids."
                : "Approved agency profile on FindMaids."}{" "}
              Confirm availability, fees and terms directly with the agency.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={agencyHref}
                className="bg-primary inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-bold text-white"
              >
                View agency profile
              </Link>
              <Link
                href="#enquire"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--border)] px-4 text-sm font-bold"
              >
                Send an enquiry
              </Link>
            </div>
          </section>

          <section id="enquire" className="mt-6">
            <EnquiryForm
              agencyId={maid.agency.id}
              agencyName={maid.agency.name}
            />
          </section>

          <p className="text-muted-foreground mt-6 text-xs leading-5">
            FindMaids is a directory and advertising platform. It does not
            recruit, employ or guarantee domestic workers. Verify the
            agency&apos;s licence, the profile details and all terms
            independently.
          </p>
        </div>
      </div>
    </Container>
  );
}
