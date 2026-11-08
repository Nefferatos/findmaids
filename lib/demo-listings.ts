export const demoAgencies = [
  {
    name: "Example Agency One",
    area: "Central Region, Singapore",
    description:
      "A fictional directory entry used to demonstrate how agency services and profile details may be presented.",
    services: ["Full-time placement", "Newborn care"],
    nationalities: ["Filipino", "Indonesian"],
    languages: ["English", "Mandarin"],
  },
  {
    name: "Example Agency Two",
    area: "East Region, Singapore",
    description:
      "An illustrative agency profile only. This name and the listed services do not represent a real business.",
    services: ["Full-time placement", "Live-in placement"],
    nationalities: ["Filipino", "Myanmar"],
    languages: ["English", "Burmese"],
  },
  {
    name: "Example Agency Three",
    area: "West Region, Singapore",
    description:
      "A made-up example showing how an agency could describe its directory listing. It is not contactable.",
    services: ["Part-time placement", "Elder care"],
    nationalities: ["Indonesian", "Sri Lankan"],
    languages: ["English", "Tamil"],
  },
] as const;

export const demoMaidProfiles = [
  {
    reference: "DEMO-001",
    age: 29,
    nationality: "Filipino",
    languages: ["English", "Tagalog"],
    placementType: "New placement",
    duties: ["General household support", "Meal preparation"],
    agency: demoAgencies[0].name,
  },
  {
    reference: "DEMO-002",
    age: 34,
    nationality: "Indonesian",
    languages: ["English", "Bahasa Indonesia"],
    placementType: "Transfer",
    duties: ["Housekeeping", "Elder care support"],
    agency: demoAgencies[1].name,
  },
  {
    reference: "DEMO-003",
    age: 27,
    nationality: "Myanmar",
    languages: ["English", "Burmese"],
    placementType: "New placement",
    duties: ["Housekeeping", "Childcare support"],
    agency: demoAgencies[1].name,
  },
  {
    reference: "DEMO-004",
    age: 32,
    nationality: "Sri Lankan",
    languages: ["English", "Tamil"],
    placementType: "Example profile",
    duties: ["Meal preparation", "General household support"],
    agency: demoAgencies[2].name,
  },
  {
    reference: "DEMO-005",
    age: 30,
    nationality: "Filipino",
    languages: ["English", "Tagalog"],
    placementType: "Example profile",
    duties: ["Newborn care support", "Housekeeping"],
    agency: demoAgencies[0].name,
  },
] as const;


export type DemoMaidStatus = "Available" | "Placed" | "On hold";

/**
 * Fictional maid roster used only by /sample/agency-dashboard so agencies and
 * the team can preview the workspace layout. These records are not stored in the
 * database, are not available workers, and never appear in the live directory.
 */
export type DemoAgencyMaid = {
  reference: string;
  agency: string;
  nationality: string;
  age: number;
  languages: string[];
  placementType: string;
  experienceYears: number;
  duties: string[];
  status: DemoMaidStatus;
  availableFrom: string;
  monthlySalarySgd: number;
};

export const demoAgencyRoster: DemoAgencyMaid[] = [
  {
    reference: "SAMPLE-101",
    agency: "Example Agency One",
    nationality: "Filipino",
    age: 29,
    languages: ["English", "Tagalog"],
    placementType: "New placement",
    experienceYears: 4,
    duties: ["Housekeeping", "Meal preparation", "Childcare support"],
    status: "Available",
    availableFrom: "Mar 2026",
    monthlySalarySgd: 620,
  },
  {
    reference: "SAMPLE-102",
    agency: "Example Agency One",
    nationality: "Filipino",
    age: 34,
    languages: ["English", "Tagalog", "Mandarin"],
    placementType: "Transfer maid",
    experienceYears: 7,
    duties: ["Newborn care", "Housekeeping"],
    status: "On hold",
    availableFrom: "Apr 2026",
    monthlySalarySgd: 780,
  },
  {
    reference: "SAMPLE-103",
    agency: "Example Agency One",
    nationality: "Indonesian",
    age: 31,
    languages: ["English", "Bahasa Indonesia"],
    placementType: "Ex-Singapore",
    experienceYears: 6,
    duties: ["Elder care support", "Meal preparation"],
    status: "Available",
    availableFrom: "Feb 2026",
    monthlySalarySgd: 700,
  },
  {
    reference: "SAMPLE-104",
    agency: "Example Agency One",
    nationality: "Myanmar",
    age: 26,
    languages: ["English", "Burmese"],
    placementType: "New placement",
    experienceYears: 2,
    duties: ["Housekeeping", "Childcare support"],
    status: "Placed",
    availableFrom: "Placed",
    monthlySalarySgd: 580,
  },
  {
    reference: "SAMPLE-201",
    agency: "Example Agency Two",
    nationality: "Myanmar",
    age: 27,
    languages: ["English", "Burmese"],
    placementType: "New placement",
    experienceYears: 3,
    duties: ["Housekeeping", "Childcare support"],
    status: "Available",
    availableFrom: "Mar 2026",
    monthlySalarySgd: 600,
  },
  {
    reference: "SAMPLE-202",
    agency: "Example Agency Two",
    nationality: "Indian",
    age: 33,
    languages: ["English", "Tamil"],
    placementType: "Transfer maid",
    experienceYears: 5,
    duties: ["Cooking", "Housekeeping"],
    status: "Available",
    availableFrom: "Feb 2026",
    monthlySalarySgd: 650,
  },
  {
    reference: "SAMPLE-203",
    agency: "Example Agency Two",
    nationality: "Filipino",
    age: 30,
    languages: ["English", "Tagalog"],
    placementType: "Ex-Singapore",
    experienceYears: 8,
    duties: ["Newborn care", "Meal preparation"],
    status: "On hold",
    availableFrom: "May 2026",
    monthlySalarySgd: 820,
  },
  {
    reference: "SAMPLE-301",
    agency: "Example Agency Three",
    nationality: "Sri Lankan",
    age: 32,
    languages: ["English", "Tamil"],
    placementType: "New placement",
    experienceYears: 4,
    duties: ["Elder care support", "Meal preparation"],
    status: "Available",
    availableFrom: "Mar 2026",
    monthlySalarySgd: 640,
  },
  {
    reference: "SAMPLE-302",
    agency: "Example Agency Three",
    nationality: "Indonesian",
    age: 28,
    languages: ["English", "Bahasa Indonesia", "Malay"],
    placementType: "Transfer maid",
    experienceYears: 5,
    duties: ["Housekeeping", "Childcare support"],
    status: "Placed",
    availableFrom: "Placed",
    monthlySalarySgd: 690,
  },
];

/** Sample workspace numbers shown on /sample/agency-dashboard. */
export const demoAgencyOverview = {
  profileViews30d: 1284,
  contactClicks30d: 96,
  enquiriesThisMonth: 12,
  respondedWithin24h: 92,
  averageRating: 4.6,
  reviewCount: 11,
  profileCompleteness: 86,
  planName: "Featured listing",
  leadAllowance: 40,
  renewsOn: "12 Mar 2026",
} as const;

export const demoAgencyLeads = [
  {
    reference: "LEAD-2401",
    name: "Sample household (Bukit Timah)",
    status: "New" as const,
    received: "2 days ago",
    summary:
      "Looking for a Filipino helper for newborn care, starting in March, live-in.",
  },
  {
    reference: "LEAD-2402",
    name: "Sample household (Tampines)",
    status: "Replied" as const,
    received: "5 days ago",
    summary: "Needs an Indonesian transfer maid with elder care experience.",
  },
  {
    reference: "LEAD-2403",
    name: "Sample household (Jurong)",
    status: "Closed" as const,
    received: "2 weeks ago",
    summary: "Enquiry filled through another agency.",
  },
];

export const demoAgencyReviews = [
  {
    author: "Sample reviewer A",
    rating: 5,
    title: "Clear process from the start",
    body: "Fictional review shown only to demonstrate the agency review panel.",
  },
  {
    author: "Sample reviewer B",
    rating: 4,
    title: "Helpful follow-up",
    body: "Illustrative text; no real employer or agency is represented here.",
  },
];

export function demoAgencyNames(): string[] {
  return demoAgencies.map((agency) => agency.name);
}

/** Filters the fictional roster for the sample workspace view. */
export function filterDemoAgencyRoster(filters: {
  agency?: string;
  nationality?: string;
  status?: string;
}): DemoAgencyMaid[] {
  const agency = filters.agency?.trim();
  const nationality = filters.nationality?.trim().toLowerCase();
  const status = filters.status?.trim().toLowerCase();
  return demoAgencyRoster.filter((maid) => {
    if (agency && maid.agency !== agency) return false;
    if (nationality && maid.nationality.toLowerCase() !== nationality) return false;
    if (status && maid.status.toLowerCase() !== status) return false;
    return true;
  });
}

/** Nationalities present in the roster, for the agency-side filter dropdown. */
export function demoRosterNationalities(agency?: string): string[] {
  const scope = agency
    ? demoAgencyRoster.filter((maid) => maid.agency === agency)
    : demoAgencyRoster;
  return [...new Set(scope.map((maid) => maid.nationality))].sort((a, b) =>
    a.localeCompare(b),
  );
}

