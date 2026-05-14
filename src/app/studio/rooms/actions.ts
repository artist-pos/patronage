"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };
  return { user, supabase };
}

export async function createPrivateRoom(data: {
  title: string;
  slug: string;
  description: string | null;
  showPrices: boolean;
  artworkIds: string[];
}): Promise<{ error?: string; roomId?: string }> {
  const auth = await getAuthenticatedUser();
  if ("error" in auth) return { error: auth.error };
  const { user, supabase } = auth;

  if (!data.title.trim()) return { error: "Title is required." };
  if (!data.slug.trim()) return { error: "Slug is required." };
  if (!/^[a-z0-9-]+$/.test(data.slug)) return { error: "Slug may only contain lowercase letters, numbers, and hyphens." };

  const { data: room, error } = await supabase
    .from("private_rooms")
    .insert({
      artist_profile_id: user.id,
      title: data.title.trim(),
      slug: data.slug.trim(),
      description: data.description?.trim() || null,
      show_prices: data.showPrices,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "You already have a room with that slug. Choose a different URL." };
    return { error: error.message };
  }

  if (data.artworkIds.length > 0) {
    await supabase.from("private_room_artworks").insert(
      data.artworkIds.map((id, i) => ({ room_id: room.id, artwork_id: id, position: i }))
    );
  }

  revalidatePath("/studio/rooms");
  return { roomId: room.id };
}

export async function deletePrivateRoom(roomId: string): Promise<{ error?: string }> {
  const auth = await getAuthenticatedUser();
  if ("error" in auth) return { error: auth.error };
  const { user, supabase } = auth;

  const { error } = await supabase
    .from("private_rooms")
    .delete()
    .eq("id", roomId)
    .eq("artist_profile_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/studio/rooms");
  return {};
}

export async function toggleRoomActive(roomId: string, isActive: boolean): Promise<{ error?: string }> {
  const auth = await getAuthenticatedUser();
  if ("error" in auth) return { error: auth.error };
  const { user, supabase } = auth;

  const { error } = await supabase
    .from("private_rooms")
    .update({ is_active: isActive })
    .eq("id", roomId)
    .eq("artist_profile_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/studio/rooms");
  return {};
}
