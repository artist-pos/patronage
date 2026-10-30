import type { SupabaseClient } from "@supabase/supabase-js";
import { toSlug, isSlugBad } from "@/lib/opportunity-slug";

interface SlugSource {
  id: string;
  slug: string | null;
  title: string | null;
  organiser: string | null;
  deadline: string | null;
  status?: string | null;
}

/**
 * The slug a listing should be published under, or null to keep the one it has.
 *
 * The insert trigger builds a slug from whatever the title was at the time, which
 * for a tip or a half-filled draft is a placeholder ("-1", "community-tip-3", the
 * tipster's wording). A listing that has never been public has no links to break,
 * so it gets a fresh organiser-title-year slug from its edited details on first
 * publish. Nothing moves a live listing back to 'pending' (only drafts are
 * submitted into it), so pending means never public. A rejected listing being
 * restored may have been live, so it keeps its slug unless it is broken.
 */
export async function slugForPublish(admin: SupabaseClient, opp: SlugSource): Promise<string | null> {
  const neverPublic = opp.status === "pending";
  if (!isSlugBad(opp.slug) && !neverPublic) return null;

  const base = toSlug(opp.title ?? "", opp.organiser ?? null, opp.deadline ?? null);
  if (!base) return null;
  if (base === opp.slug) return null;

  // Unique index on slug: take the first free candidate.
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    if (candidate === opp.slug) return null;
    const { data } = await admin
      .from("opportunities")
      .select("id")
      .eq("slug", candidate)
      .neq("id", opp.id)
      .maybeSingle();
    if (!data) return candidate;
  }
  return `${base}-${opp.id.slice(0, 8)}`;
}
