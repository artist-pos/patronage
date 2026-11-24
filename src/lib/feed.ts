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
  notes_off,
  event_date,
  event_time,
  event_venue,
  event_region_id,
  event_cv_status,
  created_at,
  profiles!project_updates_artist_id_fkey!inner (
    username,
    full_name,
    avatar_url
  )
`;

/** Detail pages also need the link card (migration 230). Kept off the shared
 *  select so the feed lists don't carry it and don't depend on the column. */
const UPDATE_DETAIL_SELECT = UPDATE_SELECT.replace("  created_at,", "  link_preview,\n  created_at,");

/** Explore's Kind filter (sidebar). Several kinds combine with OR. */
export const FEED_KINDS = ["process", "new", "event", "milestone", "av", "writing"] as const;
export type FeedKind = (typeof FEED_KINDS)[number];

export interface FeedFilters {
  kinds?: FeedKind[];
  /** A profiles.disciplines value (DisciplineEnum). */
  discipline?: string;
  /** Artist's region (profiles.region_id). */
  regionId?: string;
}

const KIND_CLAUSE: Record<FeedKind, string> = {
  process: "and(update_tag.in.(update,concept),content_type.in.(image,embed),event_date.is.null)",
  new: "update_tag.eq.complete",
  event: "event_date.not.is.null",
  milestone: "update_tag.eq.milestone",
  av: "content_type.in.(audio,video)",
  writing: "content_type.eq.text",
};

/** Parses ?kind=a,b from a URL into known kinds. */
export function parseFeedKinds(raw: string | null | undefined): FeedKind[] {
  if (!raw) return [];
  return raw.split(",").filter((k): k is FeedKind => (FEED_KINDS as readonly string[]).includes(k));
}

/**
 * Newest visible note per update, for the one-line preview on feed cards.
 * Skipped for posts with notes off. Two steps because note senders join to
 * auth.users, not profiles.
 */
async function attachLatestNotes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  updates: ProjectUpdateWithArtist[],
): Promise<ProjectUpdateWithArtist[]> {
  const ids = updates.filter((u) => !u.notes_off).map((u) => u.id);
  if (ids.length === 0) return updates;
  const { data: notes } = await supabase
    .from("project_notes")
    .select("update_id, sender_id, content, created_at")
    .in("update_id", ids)
    .eq("is_visible", true)
    .order("created_at", { ascending: false })
    .limit(ids.length * 4);
  const latest = new Map<string, { sender_id: string; content: string }>();
  for (const n of (notes ?? []) as { update_id: string; sender_id: string; content: string }[]) {
    if (!latest.has(n.update_id)) latest.set(n.update_id, n);
  }
  if (latest.size === 0) return updates;
  const senderIds = [...new Set([...latest.values()].map((n) => n.sender_id))];
  const { data: senders } = await supabase.from("profiles").select("id, full_name, username").in("id", senderIds);
  const names = new Map((senders ?? []).map((p: { id: string; full_name: string | null; username: string }) => [p.id, p.full_name ?? p.username]));
  return updates.map((u) => {
    const n = latest.get(u.id);
    return n ? { ...u, latest_note: { sender_name: names.get(n.sender_id) ?? "Someone", content: n.content } } : u;
  });
}

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
    notes_off: row.notes_off ?? false,
    event_date: row.event_date ?? null,
    event_time: row.event_time ?? null,
    event_venue: row.event_venue ?? null,
    event_region_id: row.event_region_id ?? null,
    event_cv_status: row.event_cv_status ?? null,
    link_preview: row.link_preview ?? null,
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
  filters: FeedFilters = {},
): Promise<ProjectUpdateWithArtist[]> {
  if (artistIds !== undefined && artistIds.length === 0) return [];
  const supabase = await createClient();
  let query = supabase
    .from("project_updates")
    .select(UPDATE_SELECT)
    // Under-18s stay off every public list; their own profile still shows their updates.
    .eq("profiles.is_minor", false)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (!includeAdminHidden) {
    query = query.eq("admin_hidden", false);
  }

  if (artistIds && artistIds.length > 0) {
    query = query.in("artist_id", artistIds);
  }

  if (filters.kinds && filters.kinds.length > 0) {
    query = query.or(filters.kinds.map((k) => KIND_CLAUSE[k]).join(","));
  }
  if (filters.discipline) {
    query = query.contains("profiles.disciplines", [filters.discipline]);
  }
  if (filters.regionId) {
    query = query.eq("profiles.region_id", filters.regionId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const updates = (data ?? []).map((row: any) => ({ ...mapRow(row), collaborators: [] }));
  return attachLatestNotes(supabase, updates);
}

/** Upcoming events for Explore's This week block: the next seven NZ days. */
export async function getWeekEvents(regionId: string | null, limit = 3): Promise<ProjectUpdateWithArtist[]> {
  const supabase = await createClient();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
  const end = new Date(Date.now() + 6 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
  let query = supabase
    .from("project_updates")
    .select(UPDATE_SELECT)
    .eq("profiles.is_minor", false)
    .eq("admin_hidden", false)
    .gte("event_date", today)
    .lte("event_date", end)
    .order("event_date", { ascending: true })
    .order("event_time", { ascending: true, nullsFirst: false })
    .limit(limit);
  if (regionId) query = query.eq("event_region_id", regionId);
  const { data } = await query;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- same untyped join rows as the queries above
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
    .select(UPDATE_DETAIL_SELECT)
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
