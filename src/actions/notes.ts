"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addNote(
  updateId: string,
  artistId: string,
  content: string
): Promise<{ id: string; created_at: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // is_visible: true is explicit so RLS SELECT policies that filter on is_visible
  // don't cause the read-back to return 0 rows and throw with .single()
  const { data, error } = await supabase
    .from("project_notes")
    .insert({
      update_id: updateId,
      artist_id: artistId,
      sender_id: user.id,
      content: content.trim(),
      is_visible: true,
    })
    .select("id, created_at")
    .maybeSingle(); // maybeSingle never throws on 0 rows — data is just null

  if (error) throw new Error(error.message);

  // Look up the project_id so we can revalidate the thread page as well
  const { data: updateRow } = await supabase
    .from("project_updates")
    .select("project_id")
    .eq("id", updateId)
    .single();

  revalidatePath(`/projects/${updateId}`);
  if (updateRow?.project_id) {
    revalidatePath(`/threads/${updateRow.project_id}`);
  }

  // If RLS filtered the read-back, return a stable fallback so the optimistic
  // note is never removed from the UI (it IS in the DB at this point)
  return data ?? { id: `note-${user.id}-${Date.now()}`, created_at: new Date().toISOString() };
}

export async function deleteNote(noteId: string, updateId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // RLS enforces: sender can delete own note, artist can delete notes on their content
  await supabase.from("project_notes").delete().eq("id", noteId);

  revalidatePath(`/projects/${updateId}`);
}

export async function deleteMyNote(noteId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await supabase
    .from("project_notes")
    .delete()
    .eq("id", noteId)
    .eq("sender_id", user.id);

  revalidatePath("/profile/notes");
}

