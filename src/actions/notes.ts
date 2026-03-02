"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addNote(updateId: string, artistId: string, content: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("project_notes")
    .insert({ update_id: updateId, artist_id: artistId, sender_id: user.id, content: content.trim() });

  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${updateId}`);
}

export async function deleteNote(noteId: string, updateId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await supabase
    .from("project_notes")
    .delete()
    .eq("id", noteId)
    .eq("sender_id", user.id); // only own notes

  revalidatePath(`/projects/${updateId}`);
}

export async function toggleNoteVisibility(noteId: string, isVisible: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("project_notes")
    .update({ is_visible: isVisible })
    .eq("id", noteId);

  if (error) throw new Error(error.message);
  revalidatePath("/profile/notes");
}
