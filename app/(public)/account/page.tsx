import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Container, EmptyState, SectionHeading } from "@/components/site";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your account | FindMaids",
  description:
    "Review your FindMaids account details and the enquiries you have sent to agencies.",
};

const statusLabels: Record<string, string> = {
  NEW: "Sent",
  CONTACTED: "Agency replied",
  CLOSED: "Closed",
};

const roleLabels: Record<string, string> = {
  VISITOR: "Employer",
  AGENCY: "Agency owner",
  STAFF: "FindMaids staff",
  ADMIN: "Administrator",
};

export default async function AccountPage() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) redirect("/login?callbackUrl=/account");

  const role = session.user.role ?? "VISITOR";
  const enquiries = await prisma.enquiry.findMany({
    where: { email },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      status: true,
      createdAt: true,
      message: true,
      agency: { select: { name: true, slug: true } },
    },
  });

  return (
    <Container className="py-10">
      <SectionHeading
        eyebrow="Your account"
        title={`Welcome back, ${session.user.name ?? "there"}`}
        description="Your details and every enquiry you have sent through FindMaids."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="rounded-md border bg-white p-5">
          <h2 className="font-display text-xl font-bold">Your enquiries</h2>
          {enquiries.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No enquiries yet"
                description="Browse the directory and contact an agency; your enquiries appear here."
                action={
                  <Link
                    className="bg-primary inline-flex min-h-11 items-center rounded-md px-4 font-bold text-white"
                    href="/agencies"
                  >
                    Browse agencies
                  </Link>
                }
              />
            </div>
          ) : (
            <ul className="mt-4 divide-y">
              {enquiries.map((enquiry) => (
                <li key={enquiry.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link
                      className="font-semibold underline"
                      href={`/agencies/${enquiry.agency.slug}`}
                    >
                      {enquiry.agency.name}
                    </Link>
                    <span className="text-muted-foreground text-sm">
                      {enquiry.createdAt.toLocaleDateString("en-SG", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                    {enquiry.message}
                  </p>
                  <p className="text-primary mt-1 text-sm font-semibold">
                    {statusLabels[enquiry.status] ?? enquiry.status}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-md border bg-white p-5">
            <h2 className="font-display text-xl font-bold">Account</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-semibold">{session.user.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd className="font-semibold break-all">{session.user.email}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Signed in as</dt>
                <dd className="font-semibold">{roleLabels[role] ?? role}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-md border bg-white p-5 text-sm">
            <h2 className="font-display text-xl font-bold">More</h2>
            <ul className="mt-3 space-y-2">
              <li>
                <Link className="underline" href="/agencies">
                  Browse agencies
                </Link>
              </li>
              {role === "AGENCY" && (
                <li>
                  <Link className="underline" href="/agency/dashboard">
                    Agency dashboard
                  </Link>
                </li>
              )}
              {(role === "ADMIN" || role === "STAFF") && (
                <li>
                  <Link className="underline" href="/admin">
                    Admin area
                  </Link>
                </li>
              )}
              <li>
                <Link className="underline" href="/privacy">
                  Privacy policy
                </Link>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </Container>
  );
}
