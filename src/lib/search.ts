import type { SupabaseClient } from "@supabase/supabase-js";

export const OPP_SEARCH_SELECT =
  "id, slug, title, organiser, type, country, city, deadline, featured_image_url";

/** Characters that would change the meaning of a PostgREST `.or()` filter string. */
export function cleanSearchTerm(raw: string): string {
  return raw.replace(/^@/, "").replace(/[%_,()*\\]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Ranked opportunity search. Uses the `search_opportunities` Postgres function
 * (migration 195: weighted full-text + trigram typo tolerance). Until that
 * migration has run, falls back to plain substring matching so search keeps
 * working. Rows come back in rank order.
 */
export async function searchOpportunityRows<T extends { id: string }>(
  supabase: SupabaseClient,
  q: string,
  limit: number,
  select: string = OPP_SEARCH_SELECT
): Promise<T[]> {
  const term = cleanSearchTerm(q);
  if (term.length < 2) return [];

  const ranked = await supabase.rpc("search_opportunities", { q: term, lim: limit });
  if (!ranked.error && Array.isArray(ranked.data)) {
    const ids = (ranked.data as { id: string }[]).map((r) => r.id);
    if (ids.length === 0) return [];
    const { data } = await supabase.from("opportunities").select(select).in("id", ids);
    const byId = new Map((data as unknown as T[] | null ?? []).map((o) => [o.id, o]));
    return ids.map((id) => byId.get(id)).filter((o): o is T => !!o);
  }

  const p = `%${term}%`;
  const { data } = await supabase
    .from("opportunities")
    .select(select)
    .eq("is_active", true)
    .eq("status", "published")
    .or(`title.ilike.${p},organiser.ilike.${p},description.ilike.${p},caption.ilike.${p},city.ilike.${p},grant_type.ilike.${p}`)
    .order("deadline", { ascending: true, nullsFirst: false })
    .limit(limit);
  return (data as unknown as T[] | null) ?? [];
}

export interface PartnerHit {
  id: string;
  username: string;
  name: string;
  avatar_url: string | null;
  country: string | null;
}

export async function searchPartners(
  supabase: SupabaseClient,
  q: string,
  limit: number
): Promise<PartnerHit[]> {
  const term = cleanSearchTerm(q);
  if (term.length < 2) return [];
  const p = `%${term}%`;
  const { data } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url, country")
    .eq("role", "partner")
    .eq("is_active", true)
    .or(`full_name.ilike.${p},username.ilike.${p}`)
    .limit(limit);
  return (data ?? []).map((r) => ({
    id: r.id,
    username: r.username,
    name: r.full_name?.trim() || r.username,
    avatar_url: r.avatar_url,
    country: r.country,
  }));
}
