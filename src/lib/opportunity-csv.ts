import { OPP_TYPES } from "@/lib/opportunity-constants";
import { EMAIL_RE, missingOutreachDetails } from "@/lib/claim-outreach";
import { ARTIST_PAYMENT_OPTIONS, CAPTION_MAX, CURRENCIES, normaliseOpportunityWrite } from "@/lib/opportunity-fields";

/**
 * Bulk CSV upload takes the same fields as every other opportunity form. Rows
 * have no owning organisation, so they are aggregated listings and carry the same
 * outreach details the Scraper Queue demands before approval.
 */
export const CSV_REQUIRED_COLS = [
  "title",
  "organiser",
  "type",
  "country",
  "claim_email",
  "claim_contact_name",
  "claim_current_tool",
] as const;

export const CSV_OPTIONAL_COLS = [
  "caption",
  "description",
  "city",
  "opens_at",
  "deadline",
  "funding_range",
  "entry_fee",
  "entry_fee_currency",
  "disciplines",
  "career_stage",
  "tags",
  "url",
  "contact_email",
  "artist_payment_type",
  "travel_support",
] as const;

export const CSV_COUNTRIES = ["NZ", "AUS", "Global"] as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const list = (v: string | undefined) =>
  v?.split(/[;,]/).map((s) => s.trim()).filter(Boolean) ?? [];

export async function buildCsvOpportunity(
  raw: Record<string, string>
): Promise<{ row: Record<string, unknown> } | { error: string }> {
  const title = raw.title?.trim();
  const organiser = raw.organiser?.trim();
  const type = raw.type?.trim();
  const country = raw.country?.trim();

  if (!title) return { error: "Missing required field: title" };
  if (!organiser) return { error: "Missing required field: organiser" };
  if (!OPP_TYPES.includes(type as (typeof OPP_TYPES)[number]))
    return { error: `Invalid type "${raw.type}". Must be one of: ${OPP_TYPES.join(", ")}` };
  if (!CSV_COUNTRIES.includes(country as (typeof CSV_COUNTRIES)[number]))
    return { error: `Invalid country "${raw.country}". Must be one of: ${CSV_COUNTRIES.join(", ")}` };

  const missing = missingOutreachDetails({
    email: raw.claim_email,
    contactName: raw.claim_contact_name,
    currentTool: raw.claim_current_tool,
  });
  if (missing.length > 0) return { error: `Missing ${missing.join(", ")} (claim_email, claim_contact_name, claim_current_tool)` };

  for (const col of ["opens_at", "deadline"] as const) {
    const v = raw[col]?.trim();
    if (v && !DATE_RE.test(v)) return { error: `Invalid ${col} "${v}". Use YYYY-MM-DD` };
  }
  const contactEmail = raw.contact_email?.trim();
  if (contactEmail && !EMAIL_RE.test(contactEmail)) return { error: `Invalid contact_email "${contactEmail}"` };

  const payment = raw.artist_payment_type?.trim();
  if (payment && !(ARTIST_PAYMENT_OPTIONS as readonly string[]).includes(payment))
    return { error: `Invalid artist_payment_type "${payment}". Must be one of: ${ARTIST_PAYMENT_OPTIONS.join(", ")}` };

  const currency = (raw.entry_fee_currency?.trim() || "NZD").toUpperCase();
  if (!(CURRENCIES as readonly string[]).includes(currency)) return { error: `Invalid entry_fee_currency "${currency}"` };

  const feeRaw = raw.entry_fee?.trim();
  const fee = feeRaw ? parseFloat(feeRaw) : null;
  if (feeRaw && (fee === null || Number.isNaN(fee) || fee < 0)) return { error: `Invalid entry_fee "${feeRaw}"` };

  const travel = raw.travel_support?.trim().toLowerCase();
  const url = raw.url?.trim() || null;

  const normalised = await normaliseOpportunityWrite<{
    application_links: unknown[];
    contact_email: string | null;
    entry_fee: number | null;
    entry_fee_currency: string | null;
    entry_fee_local?: number | null;
  }>({
    application_links: url ? [{ label: "Apply on Official Site", url }] : [],
    contact_email: contactEmail || null,
    entry_fee: fee,
    entry_fee_currency: currency,
  });

  const disciplines = list(raw.disciplines);
  const stages = list(raw.career_stage);
  const tags = list(raw.tags);

  return {
    row: {
      title,
      organiser,
      type,
      country,
      caption: raw.caption?.trim().slice(0, CAPTION_MAX) || null,
      full_description: raw.description?.trim() || null,
      city: raw.city?.trim() || null,
      opens_at: raw.opens_at?.trim() || null,
      deadline: raw.deadline?.trim() || null,
      funding_range: raw.funding_range?.trim() || null,
      sub_categories: disciplines.length ? disciplines : null,
      career_stage: stages.length ? stages : null,
      tags: tags.length ? tags : null,
      artist_payment_type: payment || null,
      travel_support: travel === "yes" || travel === "true" ? true : travel === "no" || travel === "false" ? false : null,
      url,
      application_links: normalised.application_links,
      contact_email: normalised.contact_email,
      entry_fee: normalised.entry_fee,
      entry_fee_currency: normalised.entry_fee_currency,
      entry_fee_local: normalised.entry_fee_local ?? null,
      claim_email: raw.claim_email.trim().toLowerCase(),
      claim_contact_name: raw.claim_contact_name.trim(),
      claim_current_tool: raw.claim_current_tool.trim(),
      routing_type: "external",
      status: "published",
      origin: "admin",
    },
  };
}
