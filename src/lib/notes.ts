import { createClient } from "@/lib/supabase/server";
import type { NoteWithSender } from "@/types/database";

export interface NoteIWrote {
  id: string;
  update_id: string;
  artist_id: string;
  content: string;
  created_at: string;
  update_image_url: string;
  update_caption: string | null;
  artist_username: string;
  artist_full_name: string | null;
}

export async function getMyWrittenNotes(senderId: string): Promise<NoteIWrote[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_notes")
    .select(`
      id,
      update_id,
      artist_id,
      content,
      created_at,
      project_updates!project_notes_update_id_fkey (
        image_url,
        caption,
        profiles!project_updates_artist_id_fkey (
          username,
          full_name
        )
      )
    `)
    .eq("sender_id", senderId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row: any) => ({
    id: row.id,
    update_id: row.update_id,
    artist_id: row.artist_id,
    content: row.content,
    created_at: row.created_at,
    update_image_url: row.project_updates?.image_url ?? "",
    update_caption: row.project_updates?.caption ?? null,
    artist_username: row.project_updates?.profiles?.username ?? "",
    artist_full_name: row.project_updates?.profiles?.full_name ?? null,
  }));
}

export async function getVisibleNotes(updateId: string): Promise<NoteWithSender[]> {
  const supabase = await createClient();

  // Step 1: fetch notes (no profile join — sender_id → auth.users, not profiles directly)
  const { data: notesData } = await supabase
    .from("project_notes")
    .select("id, update_id, artist_id, sender_id, content, is_visible, created_at")
    .eq("update_id", updateId)
    .eq("is_visible", true)
    .order("created_at", { ascending: true });

  const notes = notesData ?? [];
  if (notes.length === 0) return [];

  // Step 2: fetch profiles for all sender IDs (profiles.id mirrors auth.users.id)
  const senderIds = [...new Set(notes.map((n: any) => n.sender_id))];
  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, full_name, username, avatar_url")
    .in("id", senderIds);

  const profileMap = new Map((profilesData ?? []).map((p: any) => [p.id, p]));

  return notes.map((row: any) => {
    const profile = profileMap.get(row.sender_id);
    return {
      id: row.id,
      update_id: row.update_id,
      artist_id: row.artist_id,
      sender_id: row.sender_id,
      sender_name: profile?.full_name ?? profile?.username ?? "Anonymous",
      sender_username: profile?.username ?? "",
      sender_avatar_url: profile?.avatar_url ?? null,
      content: row.content,
      is_visible: row.is_visible,
      created_at: row.created_at,
    };
  });
}
