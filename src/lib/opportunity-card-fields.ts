// The columns an OpportunityCard renders. Kept in its own module because the
// list is needed by both the server-only opportunity queries and the regional
// page data, and regions.ts is also imported by client components.
export const CARD_FIELDS = [
  "id", "slug", "title", "organiser", "caption", "description",
  "type", "country", "city", "deadline", "opens_at", "created_at",
  "featured_image_url", "is_featured",
  "sub_categories",
  "funding_range", "funding_amount", "entry_fee",
  "grant_type", "recipients_count",
  "is_recurring", "recurrence_pattern",
].join(", ");
