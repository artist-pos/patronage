"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

interface UpdateUrls {
  image_url?: string | null;
  audio_url?: string | null;
  video_url?: string | null;
}

async function removeFromBucket(supabase: Awaited<ReturnType<typeof createClient>>, bucket: string, url: string) {
  const marker = `/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx !== -1) {
    const path = decodeURIComponent(url.slice(idx + marker.length).split("?")[0]);
    await supabase.storage.from(bucket).remove([path]);
  }
}

export async function deleteUpdate(updateId: string, urls: UpdateUrls = {}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  if (urls.image_url) await removeFromBucket(supabase, "portfolio", urls.image_url);
  if (urls.audio_url) await removeFromBucket(supabase, "audio", urls.audio_url);
  if (urls.video_url) await removeFromBucket(supabase, "video", urls.video_url);

  await supabase
    .from("project_updates")
    .delete()
    .eq("id", updateId)
    .eq("artist_id", user.id);

  revalidatePath("/");
  revalidatePath("/feed");
}

/** Edit the text of an existing studio update (caption and/or written body). */
export async function editUpdate(
  updateId: string,
  fields: { caption?: string | null; text_content?: string | null },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const patch: Record<string, string | null> = {};
  if (fields.caption !== undefined) patch.caption = fields.caption?.trim() || null;
  if (fields.text_content !== undefined) patch.text_content = fields.text_content?.trim() || null;
  if (Object.keys(patch).length === 0) return {};

  // RLS ("Artist updates own project_updates") restricts this to the owner.
  const { error } = await supabase
    .from("project_updates")
    .update(patch)
    .eq("id", updateId)
    .eq("artist_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/feed");
  revalidatePath(`/updates/${updateId}`);
  return {};
}
