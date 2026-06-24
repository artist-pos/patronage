// Shared between the anonymous free-listing wizard (writes to localStorage),
// the post-auth handoff (reads/clears it), and the finalise server action
// (whitelists the fields before creating the real draft).

export const FREE_LISTING_DRAFT_KEY = "patronage:free-listing-draft";

// Fields an anonymous user can fill on the free-listing Basics step. Mirrors the
// keys accepted by updateOpportunityPartner so the finalise step can hand them
// straight through. featured_image_url is included for completeness, but anon
// users can't upload (storage needs auth) — they add an image after signing in.
export const FREE_LISTING_FIELDS = [
  "title",
  "organiser",
  "caption",
  "full_description",
  "url",
  "application_links",
  "contact_email",
  "type",
  "country",
  "city",
  "featured_image_url",
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
export function pickFreeListingFields(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of FREE_LISTING_FIELDS) {
    if (raw[key] !== undefined) out[key] = raw[key];
  }
  return out;
}
