import { describe, expect, it } from "vitest";
import { createSlug, onboardingSubmissionSchema } from "@/lib/onboarding";

describe("agency onboarding", () => {
  it("creates URL-safe slugs from business names", () => {
    expect(createSlug("Cebu & Davao Home Care! ")).toBe("cebu-davao-home-care");
  });

  it("requires core business, contact, and service fields at submission", () => {
    const valid = onboardingSubmissionSchema.safeParse({
      name: "Sample Household Agency",
      slug: "sample-household-agency",
      description:
        "A fictional agency description with enough detail to satisfy the minimum length requirement.",
      address: "10 Example Street",
      city: "Makati",
      province: "Metro Manila",
      phone: "+639171234567",
      email: "agency@example.test",
      services: ["Full-time placement"],
      nationalitiesServed: ["Filipino"],
      languages: ["Filipino"],
      photos: [],
    });
    expect(valid.success).toBe(true);
    expect(
      onboardingSubmissionSchema.safeParse({ name: "Incomplete" }).success,
    ).toBe(false);
  });
});
