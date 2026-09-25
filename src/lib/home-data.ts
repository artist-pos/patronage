import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { ProfileWithImage, Opportunity } from "@/types/database";
import type { ProjectUpdateWithArtist } from "@/types/database";

// ── Cached public data — shared across all visitors, revalidated every 5 min ──

const UPDATE_SELECT = `
  id, artist_id, project_id, image_url, caption, content_type, discipline,
  audio_url, video_url, text_content, embed_url, embed_provider,
  orientation, image_width, image_height, collaborator_ids,
  title, tldr, update_tag, admin_hidden, created_at,
  profiles!project_updates_artist_id_fkey (username, full_name, avatar_url)
`;

export const getCachedHomeData = unstable_cache(
  async (today: string) => {
    const supabase = createPublicClient();
    const [artistsRes, oppsRes, updatesRes, oppCountRes, artistCountRes, spotlightRes, partnerCountRes] =
      await Promise.all([
        // Fetch a wider pool, then curate: profiles with an image and a bio
        // front the section — sparse profiles make the feature card look broken.
        supabase
          .from("profiles")
          .select("id, username, full_name, bio, avatar_url, featured_image_url, medium, career_stage, country, role, created_at, is_active")
          .eq("is_active", true)
          .in("role", ["artist", "owner"])
          .order("created_at", { ascending: false })
          .limit(16),
        supabase
          .from("opportunities")
          .select("id, slug, title, organiser, caption, type, country, city, deadline, opens_at, featured_image_url, is_featured, sub_categories, funding_range, funding_amount, entry_fee, grant_type, recipients_count, is_recurring, recurrence_pattern")
          .eq("is_active", true)
          .eq("status", "published")
          .or(`deadline.gte.${today},deadline.is.null`)
          .order("deadline", { ascending: true, nullsFirst: false })
          .limit(8),
        // NOT filtered on admin_hidden here: this block is unstable_cache'd and
        // shared by every visitor, so the auth-dependent filter has to happen
        // after the cache (see Home() below). Over-fetches 16 for a 12-slot strip
        // so a signed-out viewer still gets a full row once hidden posts drop out.
        supabase
          .from("project_updates")
          .select(UPDATE_SELECT)
          .order("created_at", { ascending: false })
          .limit(16),
        supabase
          .from("opportunities")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true)
          .eq("status", "published")
          .or(`deadline.gte.${today},deadline.is.null`),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true)
          .in("role", ["artist", "owner"]),
        // Admin-set spotlight — the same artist fronting /artists
        supabase
          .from("profiles")
          .select("id, username, full_name, bio, avatar_url, featured_image_url, medium, career_stage, country, role, created_at, is_active")
          .gte("spotlight_until", today)
          .order("spotlight_until", { ascending: false })
          .limit(1)
          .maybeSingle(),
        // Organisations on Patronage — partner accounts
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true)
          .eq("role", "partner"),
      ]);

    // Curate: image + bio first, then image-only, then the rest; cap at 4
    const pool: ProfileWithImage[] = (artistsRes.data ?? []).map((p: any) => ({
      ...p,
      primary_image_url: p.featured_image_url ?? null,
    }));
    const score = (p: ProfileWithImage) =>
      (p.featured_image_url || p.avatar_url ? 2 : 0) + (p.bio ? 1 : 0) + (p.full_name ? 1 : 0);
    const artists = [...pool].sort((a, b) => score(b) - score(a)).slice(0, 4);

    const opportunities = (oppsRes.data ?? []) as Opportunity[];

    const updates: ProjectUpdateWithArtist[] = (updatesRes.data ?? []).map((row: any) => ({
      id: row.id,
      artist_id: row.artist_id,
      project_id: row.project_id ?? null,
      image_url: row.image_url ?? null,
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
      admin_hidden: row.admin_hidden ?? false,
      created_at: row.created_at,
      artist_username: row.profiles?.username ?? "",
      artist_full_name: row.profiles?.full_name ?? null,
      artist_avatar_url: row.profiles?.avatar_url ?? null,
      collaborator_ids: row.collaborator_ids ?? [],
      title: row.title ?? null,
      tldr: row.tldr ?? null,
      update_tag: row.update_tag ?? "update",
      collaborators: [],
    }));

    const spotlightArtist: ProfileWithImage | null = spotlightRes.data
      ? { ...(spotlightRes.data as any), primary_image_url: (spotlightRes.data as any).featured_image_url ?? null }
      : null;

    return {
      artists,
      // Newest joins in signup order — the mobile "Recently joined" strip
      recentArtists: pool.slice(0, 10),
      spotlightArtist,
      opportunities,
      updates,
      oppCount: oppCountRes.count ?? opportunities.length,
      artistCount: artistCountRes.count ?? artists.length,
      partnerCount: partnerCountRes.count ?? 0,
    };
  },
  ["home-data-v5"],
  { revalidate: 300, tags: ["home-data"] }
);

// Usernames of verified artists (bio + avatar + 3 or more works, the same rule
// as computeBadges) for the homepage's cycling profile-URL example. Handles
// that look auto-generated (email prefixes, random hex suffixes) are skipped so
// the example reads as something an artist would actually choose.
const TIDY_HANDLE = /^[a-z0-9_-]{3,20}$/i;
const RANDOM_SUFFIX = /_[0-9a-f]{6}$/i;

export const getCachedVerifiedHandles = unstable_cache(
  async (): Promise<string[]> => {
    const supabase = createPublicClient();
    const { data: pool } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("is_active", true)
      .in("role", ["artist", "owner"])
      .not("bio", "is", null)
      .neq("bio", "")
      .not("avatar_url", "is", null)
      .not("full_name", "is", null)
      .order("created_at", { ascending: false })
      .limit(80);
    const candidates = pool ?? [];
    if (candidates.length === 0) return [];

    const { data: works } = await supabase
      .from("artworks")
      .select("profile_id")
      .in("profile_id", candidates.map((p) => p.id as string));
    const counts = new Map<string, number>();
    for (const row of works ?? []) {
      const id = (row as { profile_id: string }).profile_id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }

    return candidates
      .filter(
        (p) =>
          (counts.get(p.id as string) ?? 0) >= 3 &&
          TIDY_HANDLE.test(p.username as string) &&
          !RANDOM_SUFFIX.test(p.username as string)
      )
      .slice(0, 8)
      .map((p) => p.username as string);
  },
  ["home-verified-handles-v1"],
  { revalidate: 300, tags: ["home-data"] }
);
