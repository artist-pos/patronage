import type { Opportunity } from "@/types/database";

/** Suggestions only: the field is free text. */
export const CURRENT_TOOL_OPTIONS = [
  "Website form",
  "Google Form",
  "Jotform",
  "Email",
  "Submittable",
  "SmartyGrants",
  "CRM",
  "Post / phone",
  "Unknown",
] as const;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface OutreachDetails {
  email: string;
  contactName: string;
  currentTool: string;
}

/** Aggregated = found by the scraper, no organisation behind it yet. */
export function isAggregated(opp: Pick<Opportunity, "origin" | "profile_id">): boolean {
  return opp.origin === "scraper" && !opp.profile_id;
}

/** What's still missing before an aggregated listing can be approved or exported. */
export function missingOutreachDetails(d: Partial<OutreachDetails>): string[] {
  const missing: string[] = [];
  if (!d.email?.trim() || !EMAIL_RE.test(d.email.trim())) missing.push("contact email");
  if (!d.contactName?.trim()) missing.push("contact name");
  if (!d.currentTool?.trim()) missing.push("how they take applications");
  return missing;
}
