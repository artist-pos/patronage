import { createClient } from "@/lib/supabase/server";
import type { ProjectUpdateWithArtist } from "@/types/database";

const UPDATE_SELECT = `
  id,
  artist_id,
  project_id,
  image_url,
  thumb_url,
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
  update_tag,
  admin_hidden,
  created_at,
  profiles!project_updates_artist_id_fkey (
    username,
    full_name,
    avatar_url
  )
`;

function mapRow(row: any): Omit<ProjectUpdateWithArtist, "collaborators"> {
  return {
    id: row.id,
    artist_id: row.artist_id,
    project_id: row.project_id ?? null,
    image_url: row.image_url ?? null,
    thumb_url: row.thumb_url ?? null,
    caption: row.caption ?? null,
    content_type: row.content_type ?? "image",
    discipline: row.discipline ?? null,
    audio_url: row.audio_url ?? null,
    video_url: row.video_url ?? null,
    text_content: row.text_content ?? null,
    embed_url: row.embed_url ?? null,
    embed_provider: row.embed_provider ?? null,
    orientation: row.orientation ?? null,
    image_width: row.image_width ?? null,
    image_height: row.image_height ?? null,
    created_at: row.created_at,
    artist_username: row.profiles?.username ?? "",
    artist_full_name: row.profiles?.full_name ?? null,
    artist_avatar_url: row.profiles?.avatar_url ?? null,
    collaborator_ids: row.collaborator_ids ?? [],
    title: row.title ?? null,
    tldr: row.tldr ?? null,
    update_tag: row.update_tag ?? "update",
    admin_hidden: row.admin_hidden ?? false,
  };
}

/**
 * Explore feed page. `includeAdminHidden` should be `true` only for signed-in
 * viewers — admin-moderated updates (migration 177) stay off the signed-out
 * feed but are unchanged for everyone with an account, including the artist.
 * Defaults to `false` so a new caller can't leak a hidden update by omission.
 */
export async function getLatestUpdates(
  limit = 12,
  offset = 0,
  artistIds?: string[],
  includeAdminHidden = false,
): Promise<ProjectUpdateWithArtist[]> {
  if (artistIds !== undefined && artistIds.length === 0) return [];
  const supabase = await createClient();
  let query = supabase
    .from("project_updates")
    .select(UPDATE_SELECT)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (!includeAdminHidden) {
    query = query.eq("admin_hidden", false);
  }

  if (artistIds && artistIds.length > 0) {
    query = query.in("artist_id", artistIds);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({ ...mapRow(row), collaborators: [] }));
}

/**
 * Artist's updates — public profile Work tab and the /studio feed section.
 * Deliberately NOT filtered on admin_hidden: the flag only ever hides a post from
 * the landing page and /feed. Everywhere else, signed out included, the post is
 * untouched. Do not add the filter here.
 */
export async function getArtistUpdates(artistId: string, limit = 30): Promise<ProjectUpdateWithArtist[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_updates")
    .select(UPDATE_SELECT)
    .eq("artist_id", artistId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row: any) => ({ ...mapRow(row), collaborators: [] }));
}

/**
 * Single-update detail view (/projects/[id], /updates/[id], and both modal
 * routes). Also unfiltered — a hidden post keeps its own page and direct link
 * working for everyone, signed out included. admin_hidden governs the landing
 * page and /feed only.
 */
export async function getUpdateById(id: string): Promise<ProjectUpdateWithArtist | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_updates")
    .select(UPDATE_SELECT)
    .eq("id", id)
    .single();

  if (!data) return null;
  const row: any = data;
  const base = mapRow(row);

  // Resolve collaborator profiles for the detail view
  const collaboratorIds: string[] = base.collaborator_ids ?? [];
  let collaborators: ProjectUpdateWithArtist["collaborators"] = [];
  if (collaboratorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .in("id", collaboratorIds);
    collaborators = (profiles ?? []) as ProjectUpdateWithArtist["collaborators"];
  }

  return { ...base, collaborators };
}
