"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
    .replace(/^-|-$/g, "");
}

async function uniqueSlug(admin: ReturnType<typeof createAdminClient>, artistId: string, base: string): Promise<string> {
  let candidate = base || "series";
  let attempt = 0;
  while (true) {
    const slug = attempt === 0 ? candidate : `${candidate}-${attempt + 1}`;
    const { data } = await admin
      .from("series")
      .select("id")
      .eq("artist_id", artistId)
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return slug;
    attempt++;
  }
}

export interface ArtworkStubInput {
  existingId?: string;
  uploadedUrl?: string;
  caption: string;
  medium: string;
  year: number | null;
  forSale: boolean;
  price_cents: number | null;
  price_currency: "NZD" | "AUD";
  is_poa: boolean;
  position: number;
}

export async function createSeries(data: {
  title: string;
  description: string | null;
  hero_image_url: string;
  artworks: ArtworkStubInput[];
}): Promise<{ seriesId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  const slug = await uniqueSlug(admin, user.id, slugify(data.title));

  const { data: series, error: seriesError } = await admin
    .from("series")
    .insert({ artist_id: user.id, title: data.title, slug, hero_image_url: data.hero_image_url, description: data.description })
    .select("id")
    .single();

  if (seriesError || !series) return { error: seriesError?.message ?? "Failed to create series" };

  const artworkIds: string[] = [];

  for (const stub of data.artworks) {
    if (stub.existingId) {
      artworkIds.push(stub.existingId);
    } else if (stub.uploadedUrl) {
      const { data: artwork, error: artworkError } = await admin
        .from("artworks")
        .insert({
          profile_id: user.id,
          creator_id: user.id,
          current_owner_id: user.id,
          url: stub.uploadedUrl,
          caption: stub.caption || null,
          title: stub.caption || null,
          medium: stub.medium || null,
          year: stub.year,
          is_available: stub.forSale && !stub.is_poa && (stub.price_cents ?? 0) > 0,
          price_cents: stub.is_poa ? null : stub.price_cents,
          is_poa: stub.is_poa,
          price_currency: stub.price_currency,
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

      if (artworkError || !artwork) continue;
      artworkIds.push(artwork.id);
    }
  }

  if (artworkIds.length > 0) {
    await admin.from("series_artworks").insert(
      artworkIds.map((artwork_id, i) => ({
        series_id: series.id,
        artwork_id,
        position: i,
      }))
    );
  }

  revalidatePath("/studio");
  return { seriesId: series.id };
}

export async function updateSeries(
  seriesId: string,
  data: { title?: string; description?: string | null; hero_image_url?: string; year?: number | null }
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("series")
    .update(data)
    .eq("id", seriesId)
    .eq("artist_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/studio");
  return {};
}

export async function syncSeriesArtworks(
  seriesId: string,
  artworkIds: string[]
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  // Verify ownership
  const { data: series } = await supabase
    .from("series")
    .select("id")
    .eq("id", seriesId)
    .eq("artist_id", user.id)
    .single();
  if (!series) return { error: "Not authorised" };

  await admin.from("series_artworks").delete().eq("series_id", seriesId);

  if (artworkIds.length > 0) {
    const { error } = await admin.from("series_artworks").insert(
      artworkIds.map((artwork_id, i) => ({ series_id: seriesId, artwork_id, position: i }))
    );
    if (error) return { error: error.message };
  }

  revalidatePath("/studio");
  return {};
}

export async function toggleSeriesFeatured(seriesId: string, featured: boolean): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("series")
    .update({ is_featured: featured })
    .eq("id", seriesId)
    .eq("artist_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/studio");
  revalidatePath(`/studio/series/${seriesId}`);
  return {};
}

export async function deleteSeries(seriesId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("series")
    .delete()
    .eq("id", seriesId)
    .eq("artist_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/studio");
  return {};
}

export async function getArtistArtworksForPicker(): Promise<Array<{
  id: string;
  url: string;
  caption: string | null;
  title: string | null;
}>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("artworks")
    .select("id, url, caption, title")
    .eq("creator_id", user.id)
    .neq("source", "holder_uploaded")
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function addExistingArtworkToSeries(
  seriesId: string,
  artworkId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify series ownership
  const { data: series } = await supabase
    .from("series")
    .select("id")
    .eq("id", seriesId)
    .eq("artist_id", user.id)
    .single();
  if (!series) return { error: "Not authorised" };

  const admin = createAdminClient();

  // Get max position
  const { data: last } = await admin
    .from("series_artworks")
    .select("position")
    .eq("series_id", seriesId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await admin.from("series_artworks").upsert(
    { series_id: seriesId, artwork_id: artworkId, position: (last?.position ?? -1) + 1 },
    { onConflict: "series_id,artwork_id", ignoreDuplicates: true }
  );

  if (error) return { error: error.message };
  return {};
}
