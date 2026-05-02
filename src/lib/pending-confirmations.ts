import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Artwork,
  HolderAttributionClaim,
  Profile,
} from "@/types/database";

export interface PendingConfirmation {
  claim: HolderAttributionClaim;
  artwork: Artwork;
  holder: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

/**
 * Returns pending claims targeted at the artist (target_profile_id = artist).
 * Sorted by holder so the dashboard's "confirm all from this holder" bulk
 * action lines up with the visual grouping.
 */
export async function getPendingConfirmationsForArtist(
  artistId: string,
): Promise<PendingConfirmation[]> {
  const admin = createAdminClient();
  const { data: claims } = await admin
    .from("holder_attribution_claims")
    .select("*")
    .eq("target_profile_id", artistId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (!claims || claims.length === 0) return [];

  const artworkIds = Array.from(new Set(claims.map((c) => c.artwork_id)));
  const holderIds = Array.from(new Set(claims.map((c) => c.holder_id)));

  // Independent fetches — run together so the dashboard renders fast.
  const [artworksRes, holdersRes] = await Promise.all([
    admin.from("artworks").select("*").in("id", artworkIds),
    admin
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .in("id", holderIds),
  ]);

  const artworkById = new Map<string, Artwork>(
    (artworksRes.data ?? []).map((a) => [a.id, a as Artwork]),
  );
  const holderById = new Map<string, Pick<Profile, "id" | "username" | "full_name" | "avatar_url">>(
    (holdersRes.data ?? []).map((p) => [p.id, p]),
  );

  const result: PendingConfirmation[] = [];
  for (const c of claims) {
    const artwork = artworkById.get(c.artwork_id);
    const holder = holderById.get(c.holder_id);
    if (!artwork || !holder) continue;
    result.push({
      claim: c as HolderAttributionClaim,
      artwork,
      holder: {
        id: holder.id,
        username: holder.username,
        full_name: holder.full_name,
        avatar_url: holder.avatar_url,
      },
    });
  }
  return result;
}

/**
 * Pending count for the studio sidebar badge — cheap COUNT(*) only.
 */
export async function getPendingConfirmationCount(artistId: string): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("holder_attribution_claims")
    .select("id", { count: "exact", head: true })
    .eq("target_profile_id", artistId)
    .eq("status", "pending");
  return count ?? 0;
}
