import Link from "next/link";
import { Container, SectionHeading } from "@/components/site";
import { EmployerAssistant } from "@/components/employer-assistant";

const content: Record<
  string,
  {
    eyebrow: string;
    title: string;
    intro: string;
    sections: { title: string; body: string }[];
  }
> = {
  about: {
    eyebrow: "About",
    title: "A directory built for clearer comparisons",
    intro:
      "FindMaids helps families discover independent domestic staffing agencies in the Philippines.",
    sections: [
      {
        title: "What FindMaids does",
        body: "We publish agency-submitted profiles and provide tools to compare publicly listed services, locations, and reviews.",
      },
      {
        title: "What FindMaids does not do",
        body: "FindMaids is not a recruitment agency or employer. We do not hire domestic workers, conduct placements, validate every agency claim, or guarantee service outcomes. Contact agencies directly and verify their credentials.",
      },
    ],
  },
  contact: {
    eyebrow: "Contact",
    title: "Get in touch",
    intro:
      "For platform questions, corrections, privacy requests, or listing concerns, contact the FindMaids team.",
    sections: [
      {
        title: "Email",
        body: "Email support@findmaids.ph. Do not send sensitive identity documents unless we have provided a secure method.",
      },
      {
        title: "Agency enquiries",
        body: "Questions about a particular agency’s services should be directed to that agency using its profile contact details.",
      },
    ],
  },
  terms: {
    eyebrow: "Policies",
    title: "Terms of use",
    intro:
      "Draft terms for the FindMaids directory and advertising platform. Have these terms reviewed by qualified Philippine counsel before launch.",
    sections: [
      {
        title: "Directory role",
        body: "FindMaids provides an information and advertising platform. Agencies are independent third parties responsible for their listings, representations, recruitment practices, contracts, and services.",
      },
      {
        title: "No guarantees",
        body: "Listings, reviews, verification indicators, and sponsored placements are informational and are not guarantees, endorsements, or legal advice. Users should independently verify information and make their own decisions.",
      },
      {
        title: "Acceptable use",
        body: "Do not submit unlawful, misleading, abusive, or confidential information through the platform. We may moderate or remove content under published policies.",
      },
    ],
  },
  privacy: {
    eyebrow: "Policies",
    title: "Privacy notice",
    intro:
      "Draft privacy notice. Confirm the lawful basis, retention periods, data-subject process, and contact details with a Philippine privacy professional before launch.",
    sections: [
      {
        title: "Information collected",
        body: "Account data may include name, email address, password hash, and role. Enquiries may include name, email, phone, message, preferred start date, and budget. Reviews and basic operational events may also be stored.",
      },
      {
        title: "How information is used",
        body: "Information is used to operate accounts, route enquiries to the selected agency, moderate reviews, secure the service, and respond to user requests. Enquiry details are shared with the selected agency only to respond to that enquiry.",
      },
      {
        title: "Retention and requests",
        body: "Set and publish retention periods before launch. Users should be able to request access, correction, or deletion through the platform contact channel, subject to applicable law.",
      },
      {
        title: "Security",
        body: "Passwords are stored as hashes and reset/verification links use single-use tokens. No internet service can promise absolute security.",
      },
      {
        title: "Privacy contact and regulatory details",
        body: "Data Protection Officer: [OWNER TO COMPLETE]. DPO email and mailing address: [OWNER TO COMPLETE]. NPC registration status/reference: [OWNER TO COMPLETE after confirming applicability]. This draft is not legal advice and must be reviewed and approved by qualified Philippine counsel before publication.",
      },
    ],
  },
};

export function StaticContentPage({
  slug,
}: {
  slug: "about" | "contact" | "terms" | "privacy";
}) {
  const page = content[slug];
  return (
    <Container className="max-w-4xl py-12 sm:py-16">
      <SectionHeading
        eyebrow={page.eyebrow}
        title={page.title}
        description={page.intro}
      />
      <div className="space-y-7">
        {page.sections.map((section) => (
          <section key={section.title}>
            <h2 className="font-display text-xl font-bold">{section.title}</h2>
            <p className="text-muted-foreground mt-2 leading-7">
              {section.body}
            </p>
          </section>
        ))}
      </div>
      {slug === "contact" && (
        <p className="mt-8">
          <Link
            href="mailto:support@findmaids.ph"
            className="bg-primary rounded-md px-4 py-3 font-bold text-white"
          >
            Email FindMaids
          </Link>
        </p>
      )}
    </Container>
  );
}

export const faqEntries = [
  {
    question: "Does FindMaids recruit or employ domestic workers?",
    answer:
      "No. FindMaids is a directory and advertising platform. Agencies are independent third parties.",
  },
  {
    question: "Are agency listings guaranteed or endorsed?",
    answer:
      "No. A profile or sponsored placement is not a guarantee or endorsement. Verify agency credentials and terms directly.",
  },
  {
    question: "How do I contact an agency?",
    answer:
      "Open an approved agency profile and use its contact information or submit the enquiry form.",
  },
  {
    question: "How are reviews displayed?",
    answer:
      "Reviews are submitted by users and remain pending until moderated. Only published reviews appear on profiles.",
  },
];

export function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqEntries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
  };
  return (
    <Container className="max-w-4xl py-12 sm:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <SectionHeading
        eyebrow="Help"
        title="Frequently asked questions"
        description="Understand how FindMaids listings and enquiries work."
      />
      <div className="space-y-3">
        {faqEntries.map((entry) => (
          <details
            key={entry.question}
            className="rounded-md border bg-white p-5"
          >
            <summary className="cursor-pointer font-bold">
              {entry.question}
            </summary>
            <p className="text-muted-foreground mt-3 leading-7">
              {entry.answer}
            </p>
          </details>
        ))}
      </div>
      <EmployerAssistant />
      <p className="text-muted-foreground mt-8 text-sm">
        FindMaids is a directory/advertising platform and does not recruit or
        guarantee agency services.
      </p>
    </Container>
  );
}
