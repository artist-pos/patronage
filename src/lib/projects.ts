import { createClient } from "@/lib/supabase/server";
import type { Project, ProjectUpdateWithArtist, NoteWithSender } from "@/types/database";

export interface ThreadPost extends ProjectUpdateWithArtist {
  project_id: string | null;
  notes: NoteWithSender[];
}

export interface ProjectThread {
  project: Project & {
    artist_username: string;
    artist_full_name: string | null;
    artist_avatar_url: string | null;
  };
  posts: ThreadPost[];
}

export async function getArtistProjects(artistId: string): Promise<Project[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("id, artist_id, title, description, created_at")
    .eq("artist_id", artistId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Project[];
}

export async function getThread(projectId: string): Promise<ProjectThread | null> {
  const supabase = await createClient();

  // Fetch the project + artist profile
  const { data: projectRow } = await supabase
    .from("projects")
    .select(`
      id,
      artist_id,
      title,
      description,
      created_at,
      profiles!projects_artist_id_fkey (
        username,
        full_name,
        avatar_url
      )
    `)
    .eq("id", projectId)
    .single();

  if (!projectRow) return null;
  const pr = projectRow as any;

  // Fetch all updates belonging to this project, chronological
  const { data: updatesData } = await supabase
    .from("project_updates")
    .select(`
      id,
      artist_id,
      project_id,
      image_url,
      caption,
      content_type,
      discipline,
      audio_url,
      video_url,
      text_content,
      embed_url,
      embed_provider,
      orientation,
      created_at,
      profiles!project_updates_artist_id_fkey (
        username,
        full_name,
        avatar_url
      )
    `)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  const updates = (updatesData ?? []) as any[];

  // Fetch all visible notes for all updates — two-step to avoid broken join
  // (project_notes.sender_id → auth.users, not profiles directly)
  const updateIds = updates.map((u) => u.id);
  let allNotes: any[] = [];
  if (updateIds.length > 0) {
    const { data: notesData } = await supabase
      .from("project_notes")
      .select("id, update_id, artist_id, sender_id, content, is_visible, created_at")
      .in("update_id", updateIds)
      .eq("is_visible", true)
      .order("created_at", { ascending: true });
    allNotes = notesData ?? [];
  }

  // Fetch profiles for all note senders in one query
  let profileMap = new Map<string, any>();
  if (allNotes.length > 0) {
    const senderIds = [...new Set(allNotes.map((n) => n.sender_id))];
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url")
      .in("id", senderIds);
    profileMap = new Map((profilesData ?? []).map((p: any) => [p.id, p]));
  }

  const notesByUpdate = allNotes.reduce<Record<string, NoteWithSender[]>>((acc, n) => {
    const profile = profileMap.get(n.sender_id);
    const mapped: NoteWithSender = {
      id: n.id,
      update_id: n.update_id,
      artist_id: n.artist_id,
      sender_id: n.sender_id,
      sender_name: profile?.full_name ?? profile?.username ?? "Anonymous",
      sender_username: profile?.username ?? "",
      sender_avatar_url: profile?.avatar_url ?? null,
      content: n.content,
      is_visible: n.is_visible,
      created_at: n.created_at,
    };
    if (!acc[n.update_id]) acc[n.update_id] = [];
    acc[n.update_id].push(mapped);
    return acc;
  }, {});

  const posts: ThreadPost[] = updates.map((u) => ({
    id: u.id,
    artist_id: u.artist_id,
    project_id: u.project_id,
    image_url: u.image_url ?? null,
    caption: u.caption ?? null,
    content_type: u.content_type ?? "image",
    discipline: u.discipline ?? null,
    audio_url: u.audio_url ?? null,
    video_url: u.video_url ?? null,
    text_content: u.text_content ?? null,
    embed_url: u.embed_url ?? null,
    embed_provider: u.embed_provider ?? null,
    orientation: u.orientation ?? null,
    created_at: u.created_at,
    artist_username: u.profiles?.username ?? "",
    artist_full_name: u.profiles?.full_name ?? null,
    artist_avatar_url: u.profiles?.avatar_url ?? null,
    notes: notesByUpdate[u.id] ?? [],
  }));

  return {
    project: {
      id: pr.id,
      artist_id: pr.artist_id,
      title: pr.title,
      description: pr.description,
      created_at: pr.created_at,
      artist_username: pr.profiles?.username ?? "",
      artist_full_name: pr.profiles?.full_name ?? null,
      artist_avatar_url: pr.profiles?.avatar_url ?? null,
    },
    posts,
  };
}
