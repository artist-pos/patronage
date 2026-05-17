"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function createAdminArtworkInSeries(data: {
  seriesId: string;
  uploadedUrl: string;
  caption: string;
  position: number;
}): Promise<{ artworkId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify series ownership
  const { data: series } = await supabase
    .from("series")
    .select("id")
    .eq("id", data.seriesId)
    .eq("artist_id", user.id)
    .single();
  if (!series) return { error: "Not authorised" };

  const admin = createAdminClient();

  const { data: artwork, error: artworkError } = await admin
    .from("artworks")
    .insert({
      profile_id: user.id,
      creator_id: user.id,
      current_owner_id: user.id,
      url: data.uploadedUrl,
      caption: data.caption || null,
      title: data.caption || null,
      is_available: false,
      price_cents: null,
      is_poa: false,
      price_currency: "NZD",
      hide_available: false,
      hide_from_archive: false,
      hide_price: false,
      collection_visible: true,
      hidden_from_artist: false,
      content_type: "image",
      listing_mode: "direct_sale",
      acquisition_mode: "buy_now",
      position: 9999,
      source: "self_registered",
    })
    .select("id")
    .single();

  if (artworkError || !artwork) return { error: artworkError?.message ?? "Failed to create artwork" };

  // Get max position in series
  const { data: last } = await admin
    .from("series_artworks")
    .select("position")
    .eq("series_id", data.seriesId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  await admin.from("series_artworks").insert({
    series_id: data.seriesId,
    artwork_id: artwork.id,
    position: (last?.position ?? -1) + 1,
  });

  return { artworkId: artwork.id };
}
