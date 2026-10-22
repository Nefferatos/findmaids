import Link from "next/link";
import { Container, SectionHeading } from "@/components/site";

export const metadata = {
  title: "Guides for families | FindMaids",
  description:
    "Practical guides to comparing agencies and preparing for a conversation.",
};
const guides = [
  {
    slug: "choosing-an-agency",
    title: "A practical checklist for choosing an agency",
    description: "Compare agency information and prepare useful questions.",
  },
  {
    slug: "preparing-for-a-conversation",
    title: "Preparing for a conversation with an agency",
    description:
      "Discuss responsibilities, expectations, and personal information clearly.",
  },
];

export default function GuidesPage() {
  return (
    <Container className="max-w-5xl py-12">
      <SectionHeading
        eyebrow="Guides"
        title="Information for families"
        description="General information to help you prepare. These guides are not legal or immigration advice."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {guides.map((guide) => (
          <article key={guide.slug} className="rounded-md border bg-white p-6">
            <p className="text-primary text-sm font-bold uppercase">Guide</p>
            <h2 className="font-display mt-2 text-2xl font-bold">
              <Link className="hover:underline" href={`/guides/${guide.slug}`}>
                {guide.title}
              </Link>
            </h2>
            <p className="text-muted-foreground mt-3 text-sm leading-6">
              {guide.description}
            </p>
            <Link
              className="text-primary mt-5 inline-block font-bold underline"
              href={`/guides/${guide.slug}`}
            >
              Read guide
            </Link>
          </article>
        ))}
      </div>
    </Container>
  );
}
