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

/**
 * Aggregated = no organisation behind it yet: scraped, a community tip, or made
 * or submitted by an admin. These need outreach details before approval. An
 * organisation that submits its own listing already has an account, so doesn't.
 */
export function isAggregated(opp: Pick<Opportunity, "origin" | "profile_id">): boolean {
  return opp.origin !== "submission" && !!opp.origin && !opp.profile_id;
}

/** What a listing still needs before approval: empty for one an organisation sent in itself. */
export function outreachMissingFor(
  o: Pick<Opportunity, "origin" | "profile_id" | "claim_email" | "claim_contact_name" | "claim_current_tool">
): string[] {
  if (!isAggregated(o)) return [];
  return missingOutreachDetails({
    email: o.claim_email ?? "",
    contactName: o.claim_contact_name ?? "",
    currentTool: o.claim_current_tool ?? "",
  });
}

/**
 * A live listing nobody owns that the daily claim email can't reach yet, because
 * its outreach details are missing. Covers every origin: listings approved before
 * the details were required at review have none.
 */
export function liveOutreachMissing(
  o: Pick<Opportunity, "status" | "is_active" | "profile_id" | "claim_email" | "claim_contact_name" | "claim_current_tool">
): string[] {
  if (o.status !== "published" || !o.is_active || o.profile_id) return [];
  return missingOutreachDetails({
    email: o.claim_email ?? "",
    contactName: o.claim_contact_name ?? "",
    currentTool: o.claim_current_tool ?? "",
  });
}

/** What's still missing before an aggregated listing can be approved or exported. */
export function missingOutreachDetails(d: Partial<OutreachDetails>): string[] {
  const missing: string[] = [];
  if (!d.email?.trim() || !EMAIL_RE.test(d.email.trim())) missing.push("contact email");
  if (!d.contactName?.trim()) missing.push("contact name");
  if (!d.currentTool?.trim()) missing.push("how they take applications");
  return missing;
}
