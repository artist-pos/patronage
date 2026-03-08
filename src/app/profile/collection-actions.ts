"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function markInCollection(
  artworkId: string,
  label: string,
  patronUsername?: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Verify caller is the creator
  const { data: artwork } = await supabase
    .from("artworks")
    .select("creator_id, profile_id")
    .eq("id", artworkId)
    .single();

  if (!artwork || artwork.creator_id !== user.id) {
    return { error: "Not authorised." };
  }

  // Mark as collected
  const { error: updateError } = await supabase
    .from("artworks")
    .update({ is_available: false, collection_label: label.trim() })
    .eq("id", artworkId);

  if (updateError) return { error: updateError.message };

  // Optionally link a patron
  if (patronUsername?.trim()) {
    const { data: patronProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", patronUsername.trim())
      .single();

    if (patronProfile) {
      await supabase.from("provenance_links").insert({
        artwork_id: artworkId,
        artist_id: user.id,
        patron_id: patronProfile.id,
        status: "pending",
      });
    }
  }

  // Revalidate the artist profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  if (profile) revalidatePath(`/${profile.username}`);
  return {};
}

export async function clearCollectionStatus(artworkId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: artwork } = await supabase
    .from("artworks")
    .select("creator_id, profile_id")
    .eq("id", artworkId)
    .single();

  if (!artwork || artwork.creator_id !== user.id) {
    return { error: "Not authorised." };
  }

  const { error } = await supabase
    .from("artworks")
    .update({ is_available: true, collection_label: null })
    .eq("id", artworkId);

  if (error) return { error: error.message };

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  if (profile) revalidatePath(`/${profile.username}`);
  return {};
}
