"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function deleteUpdate(updateId: string, imageUrl: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Attempt to remove from storage (path is everything after /portfolio/)
  const marker = "/portfolio/";
  const idx = imageUrl.indexOf(marker);
  if (idx !== -1) {
    const path = decodeURIComponent(imageUrl.slice(idx + marker.length).split("?")[0]);
    await supabase.storage.from("portfolio").remove([path]);
  }

  await supabase
    .from("project_updates")
    .delete()
    .eq("id", updateId)
    .eq("artist_id", user.id);

  revalidatePath("/");
  revalidatePath("/feed");
}
