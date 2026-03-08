// Shared constants for opportunity forms, filters, and display.
// Import from here to keep all forms in sync.

export const OPP_TYPES = [
  "Grant",
  "Residency",
  "Commission",
  "Open Call",
  "Prize",
  "Display",
  "Job / Employment",
  "Studio / Space",
  "Public Art",
] as const;

export type OppType = (typeof OPP_TYPES)[number];

/** Short display labels for use in pills / badges */
export const TYPE_LABELS: Record<string, string> = {
  "Grant": "Grant",
  "Residency": "Residency",
  "Commission": "Commission",
  "Open Call": "Open Call",
  "Prize": "Prize",
  "Display": "Display",
  "Job / Employment": "Jobs",
  "Studio / Space": "Studio / Space",
  "Public Art": "Public Art",
};

export const GRANT_SUBTYPES = [
  "Project Grant",
  "Travel Stipend",
  "Residency Award",
  "Commissioning Fee",
  "Emergency Fund",
  "Salary",
  "Permanent Role",
  "Contract",
  "Other",
];

export const DISCIPLINES = [
  "Painting",
  "Sculpture",
  "Photography",
  "Ceramics",
  "Digital",
  "Printmaking",
  "Drawing",
  "Textile",
  "Film & Video",
  "Performance",
  "Installation",
  "Sound",
  "Mixed Media",
  "Poetry",
  "Writing",
  "Arts Admin",
  "Curatorial",
  "Public Art",
];

export const FOCUS_TAGS = [
  "Early Career",
  "Emerging",
  "Mid-Career",
  "Established",
  "Māori",
  "Pasifika",
  "Indigenous",
  "Women",
  "LGBTQ+",
  "Disabled artists",
  "Youth",
  "International",
  "Travel",
  "Research",
  "Community",
];

export const ELIGIBILITY_TAGS = [
  "Women",
  "LGBTQ+",
  "Māori",
  "Pasifika",
  "Indigenous",
  "Disabled artists",
];

export const CAREER_STAGE_TAGS = [
  "Early Career",
  "Emerging",
  "Mid-Career",
  "Established",
];

export const COUNTRIES = ["NZ", "AUS", "Global", "UK", "US", "EU"] as const;

/** Returns dynamic label + placeholder for the funding / compensation field based on opportunity type */
export function getFundingFieldMeta(type: string): { label: string; placeholder: string } {
  if (type === "Job / Employment") {
    return { label: "Salary / Compensation", placeholder: "e.g. $75k – $85k" };
  }
  if (type === "Studio / Space") {
    return { label: "Rent / Cost", placeholder: "e.g. $500/month" };
  }
  return { label: "Funding Range", placeholder: "e.g. $5,000 – $25,000" };
}
