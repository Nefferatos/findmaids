import { Container, SectionHeading } from "@/components/site";

export const metadata = {
  title: "Security reporting | FindMaids",
  description: "How to report a security issue to FindMaids.",
};

export default function SecurityReportingPage() {
  return (
    <Container className="max-w-3xl py-12 sm:py-16">
      <SectionHeading eyebrow="Security" title="Report a security issue" description="Please report suspected vulnerabilities privately so we can investigate and protect users." />
      <div className="space-y-4 text-sm leading-7">
        <p>Email <a className="underline" href="mailto:security@findmaids.ph">security@findmaids.ph</a> with a concise description, affected URL or component, reproduction steps that do not access other people’s data, and a safe contact address.</p>
        <p>Do not access, modify, download, or disclose another person’s data; do not perform denial-of-service testing or social engineering. Allow a reasonable time for investigation before public disclosure.</p>
        <p>Response commitment and any coordinated disclosure terms: [OWNER TO DEFINE]. This contact address must be configured and monitored before launch.</p>
      </div>
    </Container>
  );
}
