import { createClient } from "@/lib/supabase/server";
import type { NoteWithSender } from "@/types/database";

interface NoteWithUpdate extends NoteWithSender {
  update_image_url: string;
  update_caption: string | null;
}

export async function getVisibleNotes(updateId: string): Promise<NoteWithSender[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_notes")
    .select(`
      id,
      update_id,
      artist_id,
      sender_id,
      content,
      is_visible,
      created_at,
      profiles!project_notes_sender_id_fkey (
        full_name,
        username
      )
    `)
    .eq("update_id", updateId)
    .eq("is_visible", true)
    .order("created_at", { ascending: true });

  return (data ?? []).map((row: any) => ({
    id: row.id,
    update_id: row.update_id,
    artist_id: row.artist_id,
    sender_id: row.sender_id,
    sender_name: row.profiles?.full_name ?? row.profiles?.username ?? "Anonymous",
    content: row.content,
    is_visible: row.is_visible,
    created_at: row.created_at,
  }));
}

export async function getAllArtistNotes(artistId: string): Promise<NoteWithUpdate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_notes")
    .select(`
      id,
      update_id,
      artist_id,
      sender_id,
      content,
      is_visible,
      created_at,
      profiles!project_notes_sender_id_fkey (
        full_name,
        username
      ),
      project_updates!project_notes_update_id_fkey (
        image_url,
        caption
      )
    `)
    .eq("artist_id", artistId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row: any) => ({
    id: row.id,
    update_id: row.update_id,
    artist_id: row.artist_id,
    sender_id: row.sender_id,
    sender_name: row.profiles?.full_name ?? row.profiles?.username ?? "Anonymous",
    content: row.content,
    is_visible: row.is_visible,
    created_at: row.created_at,
    update_image_url: row.project_updates?.image_url ?? "",
    update_caption: row.project_updates?.caption ?? null,
  }));
}
