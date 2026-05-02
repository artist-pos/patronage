import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Artwork,
  CollectionMembership,
  ArtworkSourceDocument,
  HolderAttributionClaim,
} from "@/types/database";

export interface CollectionEntry {
  membership: CollectionMembership;
  artwork: Artwork;
  attributedArtist: {
    id: string | null;
    username: string | null;
    full_name: string | null;
  } | null;
}

/**
 * Returns the caller's collection (private — RLS enforces holder_id = auth.uid()).
 * Sorted by position then created_at desc.
 */
export async function getCollection(holderId: string): Promise<CollectionEntry[]> {
  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("collection_membership")
    .select("*")
    .eq("holder_id", holderId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });

  if (!memberships || memberships.length === 0) return [];

  const artworkIds = memberships.map((m) => m.artwork_id);

  const { data: artworks } = await supabase
    .from("artworks")
    .select("*")
    .in("id", artworkIds);

  const artworkById = new Map<string, Artwork>(
    (artworks ?? []).map((a) => [a.id, a as Artwork]),
  );

  const attributedIds = Array.from(
    new Set(
      (artworks ?? [])
        .map((a) => (a as Artwork).attributed_artist_id)
        .filter((id): id is string => !!id),
    ),
  );

  const profilesById = new Map<
    string,
    { id: string; username: string | null; full_name: string | null }
  >();

  if (attributedIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, full_name")
      .in("id", attributedIds);
    for (const p of profiles ?? []) profilesById.set(p.id, p);
  }

  const entries: CollectionEntry[] = [];
  for (const m of memberships) {
    const artwork = artworkById.get(m.artwork_id);
    if (!artwork) continue;
    const linked = artwork.attributed_artist_id
      ? profilesById.get(artwork.attributed_artist_id) ?? null
      : null;
    const attributedArtist: CollectionEntry["attributedArtist"] = linked
      ? { id: linked.id, username: linked.username, full_name: linked.full_name }
      : artwork.attributed_artist_text
        ? { id: null, username: null, full_name: artwork.attributed_artist_text }
        : null;
    entries.push({
      membership: m as CollectionMembership,
      artwork,
      attributedArtist,
    });
  }
  return entries;
}

export async function getCollectionEntry(
  membershipId: string,
  holderId: string,
): Promise<CollectionEntry | null> {
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("collection_membership")
    .select("*")
    .eq("id", membershipId)
    .eq("holder_id", holderId)
    .maybeSingle();

  if (!membership) return null;

  const { data: artwork } = await supabase
    .from("artworks")
    .select("*")
    .eq("id", membership.artwork_id)
    .maybeSingle();

  if (!artwork) return null;

  let attributedArtist: CollectionEntry["attributedArtist"] = null;
  if (artwork.attributed_artist_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, username, full_name")
      .eq("id", artwork.attributed_artist_id)
      .maybeSingle();
    if (profile) {
      attributedArtist = {
        id: profile.id,
        username: profile.username,
        full_name: profile.full_name,
      };
    }
  } else if (artwork.attributed_artist_text) {
    attributedArtist = {
      id: null,
      username: null,
      full_name: artwork.attributed_artist_text,
    };
  }

  return {
    membership: membership as CollectionMembership,
    artwork: artwork as Artwork,
    attributedArtist,
  };
}

/**
 * Invalidates the cached public collection + embed pages for a holder.
 * Call after any mutation that could change what the public sees:
 * is_public toggles, trust-tier promotions, removals, reorders.
 */
export async function revalidateHolderPublicSurfaces(holderId: string): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("username")
    .eq("id", holderId)
    .maybeSingle();
  if (!data?.username) return;
  revalidatePath(`/${data.username}/collection`);
  revalidatePath(`/embed/${data.username}/collection`);
}

export interface PublicCollectionEntry extends CollectionEntry {
  trustTier:
    | "recorded_by_artist"
    | "recorded_by_holder"
    | "confirmed_by_artist"
    | "resolved_by_patronage";
}

/**
 * Public collection for a holder (no auth required). Filters out disputed
 * works entirely and skips drafts (is_public = false). Trust tier is
 * computed in one batch query rather than N round-trips so the page renders
 * fast even at hundreds of works.
 */
export async function getPublicCollection(
  holderId: string,
): Promise<PublicCollectionEntry[]> {
  const admin = createAdminClient();

  const { data: memberships } = await admin
    .from("collection_membership")
    .select("*")
    .eq("holder_id", holderId)
    .eq("is_public", true)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });

  if (!memberships || memberships.length === 0) return [];

  const artworkIds = memberships.map((m) => m.artwork_id);

  // Fetch artworks, attributed-artist profiles, and all claim statuses for
  // these works in parallel — the page is read-only so we don't need to
  // serialise any of these.
  const [
    { data: artworks },
    { data: claims },
  ] = await Promise.all([
    admin.from("artworks").select("*").in("id", artworkIds),
    admin
      .from("holder_attribution_claims")
      .select("artwork_id, status")
      .in("artwork_id", artworkIds),
  ]);

  const artworkById = new Map<string, Artwork>(
    (artworks ?? []).map((a) => [a.id, a as Artwork]),
  );

  // Group claim statuses per artwork; pick the most-advanced one (mirrors
  // artwork_trust_tier() in migration 106 + lib/trust-tier.ts).
  const rank = (s: string) =>
    s === "confirmed" ? 0
    : s === "resolved_by_patronage" ? 1
    : s === "declined" ? 2
    : s === "pending" ? 3
    : s === "unknown" ? 4
    : 5;
  const bestStatusByArtwork = new Map<string, string>();
  for (const c of claims ?? []) {
    const prev = bestStatusByArtwork.get(c.artwork_id);
    if (!prev || rank(c.status) < rank(prev)) {
      bestStatusByArtwork.set(c.artwork_id, c.status);
    }
  }

  // Resolve attributed artists in one query (for the linked-profile case).
  const attributedIds = Array.from(
    new Set(
      (artworks ?? [])
        .map((a) => (a as Artwork).attributed_artist_id)
        .filter((id): id is string => !!id),
    ),
  );
  const profilesById = new Map<
    string,
    { id: string; username: string | null; full_name: string | null }
  >();
  if (attributedIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, username, full_name")
      .in("id", attributedIds);
    for (const p of profiles ?? []) profilesById.set(p.id, p);
  }

  const result: PublicCollectionEntry[] = [];
  for (const m of memberships) {
    const artwork = artworkById.get(m.artwork_id);
    if (!artwork) continue;

    // Tier derivation matches getTrustTier() but inlined here so we avoid
    // an extra DB round-trip per artwork.
    let tier: PublicCollectionEntry["trustTier"];
    if (artwork.source === "self_registered") {
      tier = "recorded_by_artist";
    } else {
      const status = bestStatusByArtwork.get(artwork.id);
      if (status === "declined") continue; // never surface disputed works
      tier =
        status === "confirmed" ? "confirmed_by_artist"
        : status === "resolved_by_patronage" ? "resolved_by_patronage"
        : "recorded_by_holder";
    }

    const linked = artwork.attributed_artist_id
      ? profilesById.get(artwork.attributed_artist_id) ?? null
      : null;
    const attributedArtist: CollectionEntry["attributedArtist"] = linked
      ? { id: linked.id, username: linked.username, full_name: linked.full_name }
      : artwork.attributed_artist_text
        ? { id: null, username: null, full_name: artwork.attributed_artist_text }
        : null;

    result.push({
      membership: m as CollectionMembership,
      artwork,
      attributedArtist,
      trustTier: tier,
    });
  }
  return result;
}

/**
 * Returns the holder's claim row for an artwork (one per holder per artwork).
 * Used by the detail page to show claim status + the decline-appeal CTA.
 */
export async function getHolderClaim(
  artworkId: string,
  holderId: string,
): Promise<HolderAttributionClaim | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("holder_attribution_claims")
    .select("*")
    .eq("artwork_id", artworkId)
    .eq("holder_id", holderId)
    .maybeSingle();
  return (data as HolderAttributionClaim | null) ?? null;
}

/**
 * Source documents are private — only readable by the uploader.
 * Returns documents with signed URLs for inline display.
 */
export async function listSourceDocsWithUrls(
  artworkId: string,
  uploaderId: string,
): Promise<(ArtworkSourceDocument & { signedUrl: string | null })[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("artwork_source_documents")
    .select("*")
    .eq("artwork_id", artworkId)
    .eq("uploaded_by", uploaderId)
    .order("created_at", { ascending: false });

  const docs = (data ?? []) as ArtworkSourceDocument[];
  if (docs.length === 0) return [];

  const admin = createAdminClient();
  const { data: signed } = await admin.storage
    .from("artwork-source-documents")
    .createSignedUrls(
      docs.map((d) => d.storage_path),
      3600,
    );

  const urlByPath = new Map<string, string | null>();
  for (const s of signed ?? []) {
    if (s.path) urlByPath.set(s.path, s.signedUrl ?? null);
  }

  return docs.map((d) => ({ ...d, signedUrl: urlByPath.get(d.storage_path) ?? null }));
}
