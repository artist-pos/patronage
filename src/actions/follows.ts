"use server";

import { createClient } from "@/lib/supabase/server";

export async function followArtist(followingId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Under-18 profiles can't be followed.
  const { data: target } = await supabase
    .from("profiles")
    .select("is_minor")
    .eq("id", followingId)
    .maybeSingle();
  if (target?.is_minor) return;

  await supabase
    .from("follows")
    .insert({ follower_id: user.id, following_id: followingId });
}

export async function unfollowArtist(followingId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await supabase
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", followingId);
}
