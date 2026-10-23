import { Container, SectionHeading } from "@/components/site";
import { CookieSettingsControl } from "@/components/cookie-consent";

export const metadata = {
  title: "Cookie policy | FindMaids",
  description: "Draft cookie policy for legal review.",
};

export default function CookiePolicyPage() {
  return (
    <Container className="max-w-4xl py-12 sm:py-16">
      <SectionHeading
        eyebrow="Policies · Draft"
        title="Cookie policy"
        description="This page is a draft and must be completed and reviewed by qualified Philippine counsel before launch."
      />
      <section className="space-y-4 text-sm leading-7">
        <p>FindMaids uses essential storage needed for security and service operation.</p>
        <p>Optional analytics remain disabled unless you choose Allow analytics in the cookie choices banner. You can change this choice by clearing this site’s browser storage and selecting again.</p>
        <p>Policy version: cookie-policy-v1-draft. Replace this draft with approved legal text before production.</p>
        <p>Privacy contact and retention details must be completed in coordination with the designated Data Protection Officer.</p>
        <CookieSettingsControl />
      </section>
    </Container>
  );
}
