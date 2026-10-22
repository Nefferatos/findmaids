import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";
import { Container } from "@/components/site";

const articles = {
  "choosing-an-agency": {
    title: "A practical checklist for choosing an agency",
    description: "Compare agency information and prepare useful questions.",
  },
  "preparing-for-a-conversation": {
    title: "Preparing for a conversation with an agency",
    description:
      "Discuss responsibilities, expectations, and personal information clearly.",
  },
};
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
  const source = await readFile(
    path.join(process.cwd(), "content", "guides", `${slug}.mdx`),
    "utf8",
  );
  const { content } = await compileMDX({ source });
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
        <div className="prose prose-green prose-headings:font-display prose-headings:text-foreground prose-p:leading-7 prose-a:text-primary mt-10 max-w-none">
          {content}
        </div>
      </article>
      <p className="text-muted-foreground mt-10 border-t pt-5 text-sm">
        FindMaids is an agency directory, not a recruiter. This content is
        general information only.
      </p>
    </Container>
  );
}
