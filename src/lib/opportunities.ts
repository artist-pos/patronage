import { CARD_FIELDS } from "@/lib/opportunity-card-fields";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { parseFundingText } from "./parse-funding";
import { cleanSearchTerm } from "./search";
import type { Opportunity, OpportunityFilters, OpportunityInsert, OpportunityWithMatch } from "@/types/database";


export async function getOpportunities(
  filters: OpportunityFilters = {},
  limit = 200
): Promise<Opportunity[]> {
  // Cookie-free public client: only published rows are read (public RLS), and
  // this keeps the function callable inside unstable_cache (no cookies()).
  const supabase = createPublicClient();

  const today = new Date().toISOString().split("T")[0];

  let query = supabase
    .from("opportunities")
    .select(CARD_FIELDS)
    .eq("is_active", true)
    .eq("status", "published")
    .or(`deadline.gte.${today},deadline.is.null`) // include open-ended (no deadline)
    // Not-yet-open opportunities are shown too — the card flags them with a
    // "Not yet open" badge and an "Opens in N days" countdown.
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
  // Ranked search (migration 195) when available: narrow to the matching ids,
  // then return them best-match-first. Falls back to substring matching until
  // that migration has run.
  let rankedIds: string[] | null = null;
  if (filters.search) {
    const term = cleanSearchTerm(filters.search);
    const ranked = term.length >= 2
      ? await supabase.rpc("search_opportunities", { q: term, lim: 100 })
      : null;
    if (ranked && !ranked.error && Array.isArray(ranked.data)) {
      rankedIds = (ranked.data as { id: string }[]).map((r) => r.id);
      query = query.in("id", rankedIds.length > 0 ? rankedIds : ["00000000-0000-0000-0000-000000000000"]);
    } else {
      const s = filters.search.replace(/[%_]/g, "\\$&");
      query = query.or(
        `title.ilike.%${s}%,organiser.ilike.%${s}%,city.ilike.%${s}%,caption.ilike.%${s}%,full_description.ilike.%${s}%`
      );
    }
  }

  const { data, error } = await query.limit(limit);

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Opportunity[];
  if (rankedIds) {
    const order = new Map(rankedIds.map((id, i) => [id, i]));
    rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }
  return rows;
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

// parseFundingText moved to lib/parse-funding.ts — no server dependencies,
// so client code (e.g. the opportunity-sort helper) can use it without
// pulling next/headers, dragged in via this file's Supabase server client,
// into a client bundle.

export async function getMarketplaceStats(): Promise<{
  count: number;
  totalFunding: number;
  closingThisWeek: number;
  freeToEnter: number;
}> {
  // Cookie-free public client — same data for every visitor; cacheable.
  const supabase = createPublicClient();
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

export async function getArtistScoreMap(artistId: string): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("opportunity_artist_matches")
    .select("opportunity_id, score")
    .eq("artist_id", artistId);
  return new Map((data ?? []).map((r) => [r.opportunity_id as string, r.score as number]));
}

export async function getMatchedOpportunities(
  artistId: string,
  threshold = 70,
  limit = 30
): Promise<OpportunityWithMatch[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  // Step 1: get match scores
  const { data: matches, error: matchErr } = await supabase
    .from("opportunity_artist_matches")
    .select("opportunity_id, score, reason")
    .eq("artist_id", artistId)
    .gte("score", threshold)
    .limit(limit);

  if (matchErr) throw new Error(matchErr.message);
  if (!matches?.length) return [];

  const scoreMap = new Map(matches.map((m) => [m.opportunity_id as string, { score: m.score as number, reason: m.reason as string | null }]));
  const ids = [...scoreMap.keys()];

  // Step 2: fetch the opportunity rows
  const { data: opps, error: oppErr } = await supabase
    .from("opportunities")
    .select(CARD_FIELDS)
    .in("id", ids)
    .eq("is_active", true)
    .eq("status", "published")
    .or(`deadline.gte.${today},deadline.is.null`);

  if (oppErr) throw new Error(oppErr.message);
  if (!opps?.length) return [];

  return (opps as unknown as Opportunity[])
    .map((opp) => {
      const m = scoreMap.get(opp.id);
      if (!m) return null;
      return { ...opp, match_score: m.score, match_reason: m.reason } as OpportunityWithMatch;
    })
    .filter((o): o is OpportunityWithMatch => o !== null)
    .sort((a, b) => {
      // Nulls (open-ended) go last, otherwise ascending by deadline
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return a.deadline.localeCompare(b.deadline);
    });
}

export async function insertOpportunities(rows: OpportunityInsert[]) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("opportunities")
    .insert(rows)
    .select("id, title");
  return { data, error };
}

// ─── Closed-opportunity recovery ──────────────────────────────────────────────

/** The subset a recovery suggestion card needs. */
export type SimilarOpportunity = Pick<
  Opportunity,
  | "id" | "slug" | "title" | "organiser" | "type" | "country" | "city"
  | "deadline" | "featured_image_url" | "funding_range" | "funding_amount"
  | "sub_categories"
>;

const SIMILAR_FIELDS =
  "id, slug, title, organiser, type, country, city, deadline, featured_image_url, funding_range, funding_amount, sub_categories";

/** Best available numeric read of an opportunity's value, for band comparison. */
function valueBand(o: { funding_amount: number | null; funding_range: string | null }): number {
  if (o.funding_amount != null) return o.funding_amount;
  const figures = (o.funding_range ?? "").match(/\d[\d,]*/g);
  if (!figures) return 0;
  return Math.max(...figures.map((f) => Number(f.replace(/,/g, "")) || 0));
}

/**
 * Live opportunities to offer someone who landed on a closed listing.
 *
 * Ranked by how much they resemble the dead one: shared discipline first,
 * then region, then a comparable value band. Recency is the tiebreak and the
 * fallback, so a listing with no useful metadata still gets a useful shelf
 * rather than an empty one.
 */
export async function getSimilarOpenOpportunities(
  opp: Opportunity,
  limit = 6
): Promise<SimilarOpportunity[]> {
  const supabase = createPublicClient();
  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("opportunities")
    .select(SIMILAR_FIELDS)
    .eq("is_active", true)
    .eq("status", "published")
    .neq("id", opp.id)
    .or(`deadline.gte.${today},deadline.is.null`)
    .order("deadline", { ascending: true, nullsFirst: false })
    .limit(120);

  const pool = (data ?? []) as SimilarOpportunity[];
  if (pool.length === 0) return [];

  const targetDisciplines = new Set(
    (opp.sub_categories ?? []).map((d) => d.trim().toLowerCase()).filter(Boolean)
  );
  const targetValue = valueBand(opp);
  const targetCity = opp.city?.trim().toLowerCase() ?? null;

  const scored = pool.map((c) => {
    let score = 0;

    const overlap = (c.sub_categories ?? []).filter((d) =>
      targetDisciplines.has(d.trim().toLowerCase())
    ).length;
    if (overlap > 0) score += 4 + Math.min(overlap, 3);

    if (c.country === opp.country) score += 3;
    if (targetCity && c.city?.trim().toLowerCase() === targetCity) score += 2;
    if (c.type === opp.type) score += 2;

    // Comparable money: within roughly the same order of magnitude. Only
    // meaningful when both sides actually name a figure.
    const v = valueBand(c);
    if (targetValue > 0 && v > 0) {
      const ratio = v > targetValue ? v / targetValue : targetValue / v;
      if (ratio <= 2) score += 2;
      else if (ratio <= 5) score += 1;
    }

    return { c, score };
  });

  return scored
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Recency fallback — soonest real deadline first, open-ended last.
      if (!a.c.deadline) return 1;
      if (!b.c.deadline) return -1;
      return a.c.deadline.localeCompare(b.c.deadline);
    })
    .slice(0, limit)
    .map((s) => s.c);
}
