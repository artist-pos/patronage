// Mirrors free-listing.ts for the anonymous pipeline-listing flow: an
// unauthenticated visitor fills Template + Basics, we persist to localStorage,
// then gate auth before the steps that need a real opportunity id (Form,
// Scoring, Post-selection, Review & Publish).

export const PIPELINE_LISTING_DRAFT_KEY = "patronage:pipeline-listing-draft";

// Basics fields an anonymous partner can fill before signing in. No
// application_links/url (pipeline applications route through Patronage, not an
// external link — see StepBasics) and no featured_image_url (anon users can't
// upload; storage needs auth).
export const PIPELINE_LISTING_FIELDS = [
  "title",
  "organiser",
  "caption",
  "full_description",
  "contact_email",
  "type",
  "country",
  "city",
  "sub_categories",
  "career_stage",
  "tags",
  "opens_at",
  "deadline",
  "funding_range",
  "entry_fee",
  "entry_fee_currency",
] as const;

/** Keep only known listing fields from an untrusted localStorage payload. */
export function pickPipelineListingFields(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of PIPELINE_LISTING_FIELDS) {
    if (raw[key] !== undefined) out[key] = raw[key];
  }
  return out;
}
