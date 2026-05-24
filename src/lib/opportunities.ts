import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import type { Opportunity, OpportunityFilters, OpportunityInsert } from "@/types/database";

const CARD_FIELDS = [
  "id", "slug", "title", "organiser", "caption", "description",
  "type", "country", "city", "deadline", "opens_at",
  "featured_image_url", "is_featured",
  "sub_categories",
  "funding_range", "funding_amount", "entry_fee",
  "grant_type", "recipients_count",
  "is_recurring", "recurrence_pattern",
].join(", ");

export async function getOpportunities(
  filters: OpportunityFilters = {},
  limit = 200
): Promise<Opportunity[]> {
  const supabase = await createClient();

  const today = new Date().toISOString().split("T")[0];

  let query = supabase
    .from("opportunities")
    .select(CARD_FIELDS)
    .eq("is_active", true)
    .eq("status", "published")
    .or(`deadline.gte.${today},deadline.is.null`) // include open-ended (no deadline)
    .or(`opens_at.is.null,opens_at.lte.${today}`) // hide not-yet-open opportunities
    .order("is_featured", { ascending: false })   // featured always first
    .order("deadline", { ascending: true, nullsFirst: false });

  if (filters.type) {
    query = query.eq("type", filters.type);
  }
  if (filters.country) {
    query = query.eq("country", filters.country);
  }
  if (filters.discipline) {
    query = query.contains("sub_categories", [filters.discipline]);
  }
  if (filters.freeEntry) {
    query = query.eq("entry_fee", 0);
  }
  if (filters.eligibility) {
    query = query.contains("sub_categories", [filters.eligibility]);
  }
  if (filters.careerStage) {
    query = query.or(
      `sub_categories.cs.{"${filters.careerStage}"},career_stage.cs.{"${filters.careerStage}"}`
    );
  }
  if (filters.search) {
    const s = filters.search.replace(/[%_]/g, "\\$&");
    query = query.or(
      `title.ilike.%${s}%,organiser.ilike.%${s}%,city.ilike.%${s}%,caption.ilike.%${s}%,full_description.ilike.%${s}%`
    );
  }

  const { data, error } = await query.limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Opportunity[];
}

export async function getClosingSoonOpportunities(
  limit: number
): Promise<Opportunity[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("opportunities")
    .select("*")
    .eq("is_active", true)
    .eq("status", "published")
    .or(`deadline.gte.${today},deadline.is.null`)
    .order("deadline", { ascending: true, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as Opportunity[];
}

/**
 * Parse a funding_range text string into a number in NZD-ish terms.
 * Takes the lower bound of a range, handles k/K shorthand and common
 * currency symbols/codes. Returns null if nothing parseable is found.
 *
 * Examples:
 *   "$5,000 – $15,000"  → 5000
 *   "Up to NZD 50,000"  → 50000
 *   "€2,500"            → 2500
 *   "£10k"              → 10000
 *   "AUD 20,000–30,000" → 20000
 *   "Varies"            → null
 */
function parseFundingText(text: string | null | undefined): number | null {
  if (!text) return null;
  // Strip currency codes and symbols so they don't interfere with number parsing
  const cleaned = text
    .replace(/\b(NZD|AUD|USD|GBP|EUR|CAD|SGD|HKD|JPY|CHF)\b/gi, "")
    .replace(/[$€£¥₹¢]/g, "");

  // Find all numeric tokens (handles commas and k/K suffix)
  const matches = cleaned.match(/[\d,]+(?:\.\d+)?k?/gi);
  if (!matches || matches.length === 0) return null;

  const values = matches.map((m) => {
    const isK = /k$/i.test(m);
    const num = parseFloat(m.replace(/,/g, "").replace(/k$/i, ""));
    return isK ? num * 1000 : num;
  }).filter((n) => !isNaN(n) && n > 0);

  if (values.length === 0) return null;
  // Use the lower bound (first / smallest value) to stay conservative
  return Math.min(...values);
}

export async function getMarketplaceStats(): Promise<{
  count: number;
  totalFunding: number;
  closingThisWeek: number;
  freeToEnter: number;
}> {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];
  const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [{ count }, { data: fundingData }, { count: closingCount }, { count: freeCount }] = await Promise.all([
    supabase
      .from("opportunities")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("status", "published")
      .or(`deadline.gte.${today},deadline.is.null`),
    supabase
      .from("opportunities")
      .select("funding_amount, funding_range")
      .eq("is_active", true)
      .eq("status", "published")
      .or(`deadline.gte.${today},deadline.is.null`),
    supabase
      .from("opportunities")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("status", "published")
      .gte("deadline", today)
      .lte("deadline", weekFromNow),
    supabase
      .from("opportunities")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("status", "published")
      .or(`deadline.gte.${today},deadline.is.null`)
      .or("entry_fee.is.null,entry_fee.eq.0"),
  ]);

  const totalFunding = (fundingData ?? []).reduce((s, o) => {
    // Prefer the clean numeric field; fall back to parsing the text label
    const amount =
      (o.funding_amount as number | null) ??
      parseFundingText(o.funding_range as string | null);
    return s + (amount ?? 0);
  }, 0);

  return {
    count: count ?? 0,
    totalFunding,
    closingThisWeek: closingCount ?? 0,
    freeToEnter: freeCount ?? 0,
  };
}

// Uses a cookie-free public client so this function is safe to call in the
// static pre-rendered shell of a PPR route (no cookies() call → no dynamic opt-in).
export const getOpportunityById = cache(async function getOpportunityById(idOrSlug: string): Promise<Opportunity | null> {
  const supabase = createPublicClient();

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

  const { data } = await supabase
    .from("opportunities")
    .select("*")
    .eq(isUuid ? "id" : "slug", idOrSlug)
    .eq("status", "published")
    .single();

  return data as Opportunity | null;
});

export async function insertOpportunities(rows: OpportunityInsert[]) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("opportunities")
    .insert(rows)
    .select("id, title");
  return { data, error };
}
