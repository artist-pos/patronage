// Shared constants for opportunity forms, filters, and display.
// Import from here to keep all forms in sync.

import type { PipelineConfig, RecurrencePattern } from "@/types/database";

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

/** Type options with descriptions — used in the partner submission form type selector */
export const FORM_TYPES = [
  { label: "Grant",      value: "Grant",          desc: "Funding for projects, research, or practice" },
  { label: "Residency",  value: "Residency",       desc: "Time and space to develop work" },
  { label: "Commission", value: "Commission",       desc: "Paid project or public artwork" },
  { label: "Prize",      value: "Prize",            desc: "Competition with monetary award" },
  { label: "Open Call",  value: "Open Call",        desc: "Exhibition or programme submission" },
  { label: "Job",        value: "Job / Employment", desc: "Employment or contract role" },
] as const;

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

export const CONTRACT_TYPES = [
  "Permanent",
  "Fixed Term",
  "Contract / Freelance",
  "Part-time",
  "Casual",
] as const;

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
  "Music",
  "Architecture",
  "Design",
  "Multidisciplinary",
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
  "Student",
  "Early Career",
  "Emerging",
  "Mid-Career",
  "Established",
  "All stages",
];

export const FOCUS_ONLY_TAGS = [
  "Public art",
  "Community projects",
  "Research",
  "Environmental work",
  "Experimental practice",
];

export const COUNTRIES = ["NZ", "AUS", "Global", "UK", "US", "EU"] as const;

/** Documents a partner can request from artist profiles in a pipeline application */
export const ARTIST_DOC_OPTIONS: { val: PipelineConfig["artist_documents"][number]; label: string; desc: string }[] = [
  { val: "cv",              label: "Artist CV (PDF)",    desc: "Uploaded via their profile" },
  { val: "bio",             label: "Artist biography",   desc: "From profile bio field" },
  { val: "portfolio",       label: "Portfolio images",   desc: "From their portfolio" },
  { val: "available_works", label: "Available works",    desc: "From their available works" },
];

export const RECURRENCE_OPTIONS: { value: RecurrencePattern; label: string }[] = [
  { value: "monthly",   label: "Monthly" },
  { value: "bimonthly", label: "Every 2 months" },
  { value: "quarterly", label: "Quarterly (every 3 months)" },
  { value: "biannual",  label: "Every 6 months" },
  { value: "annual",    label: "Annual" },
  { value: "custom",    label: "Custom (manual dates only)" },
];

export const INTERVAL_MONTHS: Record<string, number> = {
  monthly: 1, bimonthly: 2, quarterly: 3, biannual: 6, annual: 12,
};

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** Field visibility rules — which fields appear for each opportunity type */
export function showField(type: string, field: string): boolean {
  const map: Record<string, string[]> = {
    entryFee:      ["Prize", "Open Call"],
    recipients:    ["Grant", "Prize"],
    funding:       ["Grant", "Residency", "Commission", "Prize", "Job / Employment"],
    grantSubtype:  ["Grant"],
    duration:      ["Residency"],
    contractType:  ["Job / Employment"],
    accommodation: ["Residency"],
    eligibility:   ["Grant", "Residency", "Commission", "Prize", "Open Call"],
  };
  return map[field]?.includes(type) ?? true;
}

/** Returns dynamic label + placeholder for the funding / compensation field based on opportunity type */
export function getFundingFieldMeta(type: string): { label: string; placeholder: string } {
  if (type === "Job / Employment") return { label: "Salary / Compensation", placeholder: "e.g. $75k – $85k" };
  if (type === "Studio / Space")   return { label: "Rent / Cost",           placeholder: "e.g. $500/month" };
  if (type === "Residency")        return { label: "Stipend (optional)",     placeholder: "e.g. $500/week" };
  if (type === "Commission")       return { label: "Budget",                 placeholder: "e.g. $10,000 – $50,000" };
  if (type === "Prize")            return { label: "Prize Value",            placeholder: "e.g. $5,000 first prize" };
  return                                   { label: "Funding Range",         placeholder: "e.g. $5,000 – $25,000" };
}
