import { createClient } from "@/lib/supabase/server";
import type { Project, ProjectUpdateWithArtist, CollaboratorProfile, NoteWithSender } from "@/types/database";

export interface ThreadPost extends ProjectUpdateWithArtist {
  project_id: string | null;
  notes: NoteWithSender[];
}

export interface ProjectThread {
  project: Project & {
    slug: string | null;
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
  return (data ?? []).map(r => ({ ...r, opportunity_id: null, artwork_id: null })) as Project[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getThread(idOrSlug: string): Promise<ProjectThread | null> {
  const supabase = await createClient();

  const PROJECT_SELECT = `
    id, artist_id, title, description, slug, created_at,
    profiles!projects_artist_id_fkey (username, full_name, avatar_url)
  `;

  // Accept UUID or human slug
  const { data: projectRow } = UUID_RE.test(idOrSlug)
    ? await supabase.from("projects").select(PROJECT_SELECT).eq("id", idOrSlug).maybeSingle()
    : await supabase.from("projects").select(PROJECT_SELECT).eq("slug", idOrSlug).maybeSingle();

  if (!projectRow) return null;
  const pr = projectRow as any; // eslint-disable-line @typescript-eslint/no-explicit-any

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
      image_width,
      image_height,
      collaborator_ids,
      title,
      tldr,
      created_at,
      profiles!project_updates_artist_id_fkey (
        username,
        full_name,
        avatar_url
      )
    `)
    .eq("project_id", pr.id)
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

  // Batch-resolve all collaborator profiles across all posts in one query
  const allCollaboratorIds = [...new Set(updates.flatMap((u) => u.collaborator_ids ?? []))];
  let collaboratorMap = new Map<string, CollaboratorProfile>();
  if (allCollaboratorIds.length > 0) {
    const { data: collabData } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .in("id", allCollaboratorIds);
    collaboratorMap = new Map((collabData ?? []).map((p: any) => [p.id, p as CollaboratorProfile]));
  }

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
    image_width: u.image_width ?? null,
    image_height: u.image_height ?? null,
    created_at: u.created_at,
    artist_username: u.profiles?.username ?? "",
    artist_full_name: u.profiles?.full_name ?? null,
    artist_avatar_url: u.profiles?.avatar_url ?? null,
    collaborator_ids: u.collaborator_ids ?? [],
    collaborators: (u.collaborator_ids ?? []).map((id: string) => collaboratorMap.get(id)).filter(Boolean) as CollaboratorProfile[],
    notes: notesByUpdate[u.id] ?? [],
    title: u.title ?? null,
    tldr: u.tldr ?? null,
    update_tag: u.update_tag ?? "update",
  }));

  return {
    project: {
      id: pr.id,
      artist_id: pr.artist_id,
      title: pr.title,
      description: pr.description,
      slug: pr.slug ?? null,
      opportunity_id: null,
      artwork_id: null,
      created_at: pr.created_at,
      artist_username: pr.profiles?.username ?? "",
      artist_full_name: pr.profiles?.full_name ?? null,
      artist_avatar_url: pr.profiles?.avatar_url ?? null,
    },
    posts,
  };
}
