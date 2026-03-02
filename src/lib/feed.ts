import { createClient } from "@/lib/supabase/server";
import type { ProjectUpdateWithArtist } from "@/types/database";

export async function getLatestUpdates(limit = 20): Promise<ProjectUpdateWithArtist[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_updates")
    .select(`
      id,
      artist_id,
      image_url,
      caption,
      created_at,
      profiles!project_updates_artist_id_fkey (
        username,
        full_name,
        avatar_url
      )
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row: any) => ({
    id: row.id,
    artist_id: row.artist_id,
    project_id: null,
    image_url: row.image_url,
    caption: row.caption,
    created_at: row.created_at,
    artist_username: row.profiles?.username ?? "",
    artist_full_name: row.profiles?.full_name ?? null,
    artist_avatar_url: row.profiles?.avatar_url ?? null,
  }));
}

export async function getArtistUpdates(artistId: string, limit = 30): Promise<ProjectUpdateWithArtist[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_updates")
    .select(`
      id,
      artist_id,
      project_id,
      image_url,
      caption,
      created_at,
      profiles!project_updates_artist_id_fkey (
        username,
        full_name,
        avatar_url
      )
    `)
    .eq("artist_id", artistId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row: any) => ({
    id: row.id,
    artist_id: row.artist_id,
    project_id: row.project_id ?? null,
    image_url: row.image_url,
    caption: row.caption,
    created_at: row.created_at,
    artist_username: row.profiles?.username ?? "",
    artist_full_name: row.profiles?.full_name ?? null,
    artist_avatar_url: row.profiles?.avatar_url ?? null,
  }));
}

export async function getUpdateById(id: string): Promise<ProjectUpdateWithArtist | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_updates")
    .select(`
      id,
      artist_id,
      image_url,
      caption,
      created_at,
      profiles!project_updates_artist_id_fkey (
        username,
        full_name,
        avatar_url
      )
    `)
    .eq("id", id)
    .single();

  if (!data) return null;
  const row: any = data;
  return {
    id: row.id,
    artist_id: row.artist_id,
    project_id: null,
    image_url: row.image_url,
    caption: row.caption,
    created_at: row.created_at,
    artist_username: row.profiles?.username ?? "",
    artist_full_name: row.profiles?.full_name ?? null,
    artist_avatar_url: row.profiles?.avatar_url ?? null,
  };
}
