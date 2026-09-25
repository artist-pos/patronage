import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Commerce (sales, support tiers, campaign sales, negotiated sales, Stripe
 * Connect setup) is open to Verified artists only: a bio, a profile photo and
 * at least three works — the same rule as `computeBadges().verified`.
 *
 * Server-only. Every artist-seller checkout and the Connect/tier setup actions
 * call this, since server actions are public endpoints and hiding a button is
 * cosmetic.
 */
export const COMMERCE_WORKS_REQUIRED = 3;

export interface CommerceEligibility {
  eligible: boolean;
  /** Human-readable gaps, for the artist-facing error. Empty when eligible. */
  missing: string[];
}

export async function getCommerceEligibility(artistId: string): Promise<CommerceEligibility> {
  const admin = createAdminClient();
  const [{ data: profile }, { count }] = await Promise.all([
    admin.from("profiles").select("bio, avatar_url").eq("id", artistId).maybeSingle(),
    admin.from("artworks").select("id", { count: "exact", head: true }).eq("profile_id", artistId),
  ]);

  const missing: string[] = [];
  if (!profile?.bio?.trim()) missing.push("a bio");
  if (!profile?.avatar_url) missing.push("a profile photo");
  const works = count ?? 0;
  if (works < COMMERCE_WORKS_REQUIRED) {
    missing.push(`${COMMERCE_WORKS_REQUIRED - works} more work${COMMERCE_WORKS_REQUIRED - works === 1 ? "" : "s"}`);
  }
  return { eligible: missing.length === 0, missing };
}

/**
 * Of these seller profiles, which can actually be paid right now: Stripe
 * Connect enabled, and — for artists — Verified by the same rule as above.
 * Browse surfaces (/works, Explore, /patrons) show a work for sale only when
 * its seller is in this set, so a buyer never reaches a Buy button that the
 * checkout would refuse. One query for the whole batch.
 */
export async function getSellableSellerIds(profileIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(profileIds.filter(Boolean))];
  if (ids.length === 0) return new Set();

  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, role, bio, avatar_url, stripe_connect_status, artworks!profile_id(count)")
    .in("id", ids);

  const sellable = new Set<string>();
  for (const p of (data ?? []) as Array<{
    id: string;
    role: string | null;
    bio: string | null;
    avatar_url: string | null;
    stripe_connect_status: string | null;
    artworks: { count: number }[] | null;
  }>) {
    if (p.stripe_connect_status !== "enabled") continue;
    const isArtist = p.role === "artist" || p.role === "owner";
    const works = p.artworks?.[0]?.count ?? 0;
    const verified = !!p.bio?.trim() && !!p.avatar_url && works >= COMMERCE_WORKS_REQUIRED;
    if (!isArtist || verified) sellable.add(p.id);
  }
  return sellable;
}

/** For the artist themselves (setup actions). */
export function eligibilityError(e: CommerceEligibility): string {
  return `Selling and support open once your profile is Verified. Add ${joinList(e.missing)}.`;
}

/** For a buyer or supporter hitting a checkout for an unverified artist. */
export const SELLER_NOT_ELIGIBLE = "This artist isn't set up to receive payments yet.";

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
