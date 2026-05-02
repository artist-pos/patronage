import { createAdminClient } from "@/lib/supabase/admin";
import type { ArtworkTrustTier } from "@/types/database";

/**
 * Trust-tier rules mirror artwork_trust_tier() in migration 106. We compute
 * in TS as well so we can join with other queries without hitting the SQL
 * function. The DB function is the source of truth for derived columns and
 * any future view; this is a read helper for app code.
 */

interface TrustTierLabel {
  tier: ArtworkTrustTier;
  label: string;
  description: string;
}

export const TRUST_TIER_LABELS: Record<ArtworkTrustTier, TrustTierLabel> = {
  recorded_by_artist: {
    tier: "recorded_by_artist",
    label: "Recorded by artist",
    description: "Registered on Patronage by the artist who created the work.",
  },
  recorded_by_holder: {
    tier: "recorded_by_holder",
    label: "Recorded by holder",
    description:
      "Registered on Patronage by the work's holder. The artist hasn't confirmed this record yet.",
  },
  confirmed_by_artist: {
    tier: "confirmed_by_artist",
    label: "Confirmed by artist",
    description: "The artist has confirmed this record on Patronage.",
  },
  resolved_by_patronage: {
    tier: "resolved_by_patronage",
    label: "Resolved by Patronage",
    description:
      "Patronage adjudicated a dispute about this record. See the resolution note for details.",
  },
  disputed: {
    tier: "disputed",
    label: "Disputed",
    description:
      "The artist declined this record. The work stays in the holder's private vault but is hidden from public surfaces.",
  },
};

/**
 * Returns the trust tier for an artwork. Reads through the admin client so
 * RLS doesn't hide pending claims when the page is rendered for a public
 * (unauthenticated) viewer.
 */
export async function getTrustTier(artworkId: string): Promise<ArtworkTrustTier | null> {
  const admin = createAdminClient();
  const { data: artwork } = await admin
    .from("artworks")
    .select("source")
    .eq("id", artworkId)
    .maybeSingle();
  if (!artwork) return null;

  if (artwork.source === "self_registered") return "recorded_by_artist";

  // Pick the most-advanced status across all claims for this artwork.
  // Mirrors the ORDER BY in artwork_trust_tier().
  const { data: claims } = await admin
    .from("holder_attribution_claims")
    .select("status")
    .eq("artwork_id", artworkId);

  if (!claims || claims.length === 0) return "recorded_by_holder";

  const ranked = (status: string) => {
    switch (status) {
      case "confirmed":             return 0;
      case "resolved_by_patronage": return 1;
      case "declined":              return 2;
      case "pending":               return 3;
      case "unknown":               return 4;
      default:                      return 5;
    }
  };
  const best = claims
    .map((c) => c.status)
    .sort((a, b) => ranked(a) - ranked(b))[0];

  if (best === "confirmed")             return "confirmed_by_artist";
  if (best === "resolved_by_patronage") return "resolved_by_patronage";
  if (best === "declined")              return "disputed";
  return "recorded_by_holder";
}
