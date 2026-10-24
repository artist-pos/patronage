import { createAdminClient } from "@/lib/supabase/admin";
import { GST_LABEL, gstOf } from "@/lib/rabobank/quote";

export const REACTIONS = [
  { key: "speaks", label: "Speaks to me" },
  { key: "unsure", label: "Not sure" },
  { key: "not_for_space", label: "Not for this space" },
] as const;
export type ReactionKey = (typeof REACTIONS)[number]["key"];

export const DEFAULT_SHORTLIST_INTRO = "Your input informs the recommendation. It is not a vote.";

export interface Work {
  id: string;
  artist_id: string;
  image_url: string;
  thumb_url: string | null;
  title: string | null;
  size: string | null;
  year: string | null;
  medium: string | null;
  sort_order: number;
}

/** Everything staff may see. There is deliberately no commercial field. */
export interface ArtistCard {
  id: string;
  name: string;
  region: string | null;
  medium: string | null;
  curator_note: string | null;
  website_url: string | null;
  sort_order: number;
  visible: boolean;
  // From the artist's own profile (migration 216); null for manually added artists.
  invite_id: string | null;
  photo_url: string | null;
  bio: string | null;
  instagram: string | null;
  other_links: string | null;
  staff_prompt_answer: string | null;
  works: Work[];
}

export interface Commercial {
  fee_indicative: string | null;
  timeline_indicative: string | null;
}

/** Artists with works, in curator order. Never reads the commercial table. */
export async function getArtistCards(opts: { includeHidden: boolean }): Promise<ArtistCard[]> {
  const admin = createAdminClient();
  let q = admin
    .from("rabobank_artist")
    .select("id, name, region, medium, curator_note, website_url, sort_order, visible, invite_id, photo_url, bio, instagram, other_links, staff_prompt_answer")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (!opts.includeHidden) q = q.eq("visible", true);
  const { data: artists } = await q;
  if (!artists?.length) return [];

  const { data: works } = await admin
    .from("rabobank_work")
    .select("id, artist_id, image_url, thumb_url, title, size, year, medium, sort_order")
    .in("artist_id", artists.map((a) => a.id))
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return artists.map((a) => ({
    ...a,
    works: (works ?? []).filter((w) => w.artist_id === a.id),
  }));
}

/**
 * Only called when Blake has turned on "staff see quotes". One plain line per
 * shortlisted artist, e.g. "1800 x 900: $4,200 (excl. GST)".
 */
export async function getStaffQuoteLines(artists: ArtistCard[]): Promise<Record<string, string>> {
  const byInvite = new Map(artists.filter((a) => a.invite_id).map((a) => [a.invite_id!, a.id]));
  if (!byInvite.size) return {};
  const { data } = await createAdminClient()
    .from("rabobank_quote")
    .select("invite_id, fee_1800x900, fee_1600x800, gst_inclusive, gst_treatment")
    .eq("status", "submitted")
    .in("invite_id", [...byInvite.keys()]);
  const money = (n: unknown) => "$" + Number(n).toLocaleString("en-NZ", { maximumFractionDigits: 2 });
  const out: Record<string, string> = {};
  for (const q of data ?? []) {
    const treatment = gstOf(q);
    const gst = treatment ? GST_LABEL[treatment] : "GST not stated";
    const parts = [
      q.fee_1800x900 !== null && `1800 x 900: ${money(q.fee_1800x900)}`,
      q.fee_1600x800 !== null && `1600 x 800: ${money(q.fee_1600x800)}`,
    ].filter(Boolean);
    if (parts.length) out[byInvite.get(q.invite_id)!] = `${parts.join(" · ")} (${gst})`;
  }
  return out;
}

/** Client and admin only. */
export async function getCommercial(): Promise<Record<string, Commercial>> {
  const { data } = await createAdminClient()
    .from("rabobank_artist_commercial")
    .select("artist_id, fee_indicative, timeline_indicative");
  return Object.fromEntries((data ?? []).map((r) => [r.artist_id, r]));
}

export interface ReactionStats {
  counts: Record<string, Record<ReactionKey, number>>;
  /** Distinct devices that have reacted to at least one artist. */
  responded: number;
}

export async function getReactionStats(): Promise<ReactionStats> {
  const { data } = await createAdminClient()
    .from("rabobank_reaction")
    .select("artist_id, respondent_id, reaction");
  const counts: ReactionStats["counts"] = {};
  const people = new Set<string>();
  for (const r of data ?? []) {
    people.add(r.respondent_id);
    counts[r.artist_id] ??= { speaks: 0, unsure: 0, not_for_space: 0 };
    counts[r.artist_id][r.reaction as ReactionKey] += 1;
  }
  return { counts, responded: people.size };
}

export function safeUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}
