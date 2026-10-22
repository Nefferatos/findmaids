import Link from "next/link";
import { Container, SectionHeading } from "@/components/site";
import { prisma } from "@/lib/prisma";

export const revalidate = 300;
export const metadata = {
  title: "Advertise your agency | FindMaids",
  description:
    "Explore directory plans for independent maid agencies in the Philippines.",
  openGraph: {
    title: "Advertise with FindMaids",
    description: "Help families discover your agency profile.",
  },
};

export default async function AdvertisePage() {
  const plans = await prisma.plan
    .findMany({
      where: { isActive: true },
      orderBy: { listingPriority: "asc" },
    })
    .catch((error) => {
      console.error("Unable to load plans", error);
      return [];
    });
  return (
    <>
      <section className="bg-[#e8f0e6] py-14">
        <Container>
          <SectionHeading
            eyebrow="For agencies"
            title="Help the right families find you"
            description="Create a clear agency profile, share the services you offer, and receive direct enquiries. You remain responsible for your listing and services."
          />
          <Link
            href="/register?type=agency"
            className="bg-primary inline-flex min-h-11 items-center rounded-md px-5 font-bold text-white"
          >
            Register your agency
          </Link>
        </Container>
      </section>
      <Container className="py-14">
        <SectionHeading
          eyebrow="Plans"
          title="Choose a listing plan"
          description="Prices shown are the current plan records. Checkout and subscriptions are not enabled in this release."
        />
        {plans.length ? (
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => {
              const features = Array.isArray(plan.features)
                ? plan.features.filter(
                    (feature): feature is string => typeof feature === "string",
                  )
                : [];
              return (
                <article
                  key={plan.id}
                  className="flex flex-col rounded-md border bg-white p-6"
                >
                  <h2 className="font-display text-2xl font-bold">
                    {plan.name}
                  </h2>
                  <p className="mt-3 text-3xl font-bold">
                    ₱{Number(plan.priceMonthly).toLocaleString("en-PH")}
                    <span className="text-muted-foreground text-sm font-normal">
                      {" "}
                      / month
                    </span>
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    ₱{Number(plan.priceYearly).toLocaleString("en-PH")} yearly
                  </p>
                  <ul className="my-6 flex-1 space-y-2 text-sm">
                    {features.map((feature) => (
                      <li key={feature} className="border-t pt-2">
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/register?type=agency"
                    className="border-primary text-primary inline-flex min-h-11 items-center justify-center rounded-md border px-4 font-bold hover:bg-[#e8f0e6]"
                  >
                    Create agency account
                  </Link>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground rounded-md border bg-white p-6">
            Plans are temporarily unavailable. Contact us for agency listing
            information.
          </p>
        )}
        <section className="mt-14">
          <SectionHeading eyebrow="Questions" title="Frequently asked" />
          <div className="space-y-3">
            {[
              {
                q: "Can I pay online?",
                a: "Online checkout is not available yet. Creating an agency account does not start a paid subscription.",
              },
              {
                q: "Does a paid plan guarantee enquiries?",
                a: "No. Placement, profile features, and advertising do not guarantee enquiries or business outcomes.",
              },
              {
                q: "Can I edit my profile?",
                a: "Agency profile management is planned for a later release. Contact the team for current listing updates.",
              },
            ].map(({ q, a }) => (
              <details key={q} className="rounded-md border bg-white p-5">
                <summary className="cursor-pointer font-bold">{q}</summary>
                <p className="text-muted-foreground mt-3 leading-7">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </Container>
    </>
  );
}
