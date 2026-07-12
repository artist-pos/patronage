"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Admin: set (or clear) the featured/spotlight artist. One spotlight at a
 * time — setting a new one clears every other profile's spotlight_until.
 * Drives the /artists hero and the home-page artist feature.
 */
export async function setSpotlightArtist(
  profileId: string,
  until: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "admin" && me?.role !== "owner") {
    return { error: "Not authorised." };
  }

  if (until && !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
    return { error: "Invalid date." };
  }

  const admin = createAdminClient();

  if (until) {
    // Single spotlight: clear all others first
    const { error: clearError } = await admin
      .from("profiles")
      .update({ spotlight_until: null })
      .not("spotlight_until", "is", null)
      .neq("id", profileId);
    if (clearError) return { error: clearError.message };
  }

  const { error } = await admin
    .from("profiles")
    .update({ spotlight_until: until })
    .eq("id", profileId);
  if (error) return { error: error.message };

  revalidatePath("/artists");
  revalidatePath("/");
  revalidateTag("home-data", "max"); // home's unstable_cache carries the spotlight
  return {};
}
