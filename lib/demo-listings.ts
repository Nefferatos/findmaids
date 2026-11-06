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
