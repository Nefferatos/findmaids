import { notFound } from "next/navigation";
import { Container } from "@/components/site";

/**
 * The guide bodies live here rather than in `content/guides/*.mdx`: the Worker
 * cannot read project files at runtime (`process.cwd()` is not the repo) and
 * compiling MDX per request is wasted CPU. Two short articles, so inlining them
 * keeps the route static-free and reliable.
 */
const articles = {
  "choosing-an-agency": {
    title: "A practical checklist for choosing an agency",
    description: "Compare agency information and prepare useful questions.",
    sections: [
      {
        heading: "Start with your requirements",
        body: "Write down the schedule, duties, location, experience, and languages that matter to your household. Discuss expectations clearly with any agency you contact.",
      },
      {
        heading: "Check information directly",
        body: "Use directory profiles to compare details, then independently confirm licences, fees, contract terms, and current availability with the agency.",
      },
      {
        heading: "Ask practical questions",
        body: "Ask how screening works, what support is provided after placement, how concerns are handled, and which costs may apply. Keep written copies of important terms.",
      },
    ],
    footnote:
      "FindMaids is a directory, not a recruiter, and does not guarantee agency services.",
  },
  "preparing-for-a-conversation": {
    title: "Preparing for a conversation with an agency",
    description:
      "Discuss responsibilities, expectations, and personal information clearly.",
    sections: [
      {
        heading: "Be specific about the role",
        body: "Describe the work, daily routine, rest periods, household members, and any care needs. A clear conversation helps both sides decide whether the arrangement is suitable.",
      },
      {
        heading: "Discuss terms openly",
        body: "Confirm responsibilities, compensation, days off, accommodation if applicable, and the process for resolving problems. Ask the agency to explain any unclear terms before agreeing.",
      },
      {
        heading: "Protect personal information",
        body: "Only share information needed for the conversation, and ask how it will be used. Do not send identity documents through an unverified channel.",
      },
    ],
    footnote:
      "This guide is general information, not legal or immigration advice.",
  },
} as const;

// Prerendered: the bodies are constants, and the public shell no longer reads
// the session server-side, so these two guides ship as static assets instead of
// costing SSR CPU on every request.
// Only the two written guides exist; any other slug is a routing-level 404
// (dynamicParams = false) instead of a post-stream 200 with 404 UI.
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(articles).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = articles[slug as keyof typeof articles];
  return article
    ? {
        title: `${article.title} | FindMaids`,
        description: article.description,
        openGraph: {
          title: article.title,
          description: article.description,
          type: "article",
        },
      }
    : { title: "Guide not found | FindMaids" };
}

export default async function GuideArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = articles[slug as keyof typeof articles];
  if (!article) notFound();
  return (
    <Container className="max-w-3xl py-12 sm:py-16">
      <article>
        <p className="text-primary text-sm font-bold uppercase">Family guide</p>
        <h1 className="font-display mt-2 text-4xl font-bold">
          {article.title}
        </h1>
        <p className="text-muted-foreground mt-4 text-lg leading-7">
          {article.description}
        </p>
        <div className="prose prose-green prose-headings:font-display prose-headings:text-foreground prose-p:leading-7 mt-10 max-w-none">
          {article.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              <p>{section.body}</p>
            </section>
          ))}
        </div>
      </article>
      <p className="text-muted-foreground mt-10 border-t pt-5 text-sm">
        {article.footnote}
      </p>
    </Container>
  );
}
