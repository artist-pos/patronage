import type { SupabaseClient } from "@supabase/supabase-js";
import { gridImageSrc } from "@/lib/image";
import type { BoardItemType } from "@/types/database";

/** What a board tile needs, whatever kind of thing was saved. */
export interface BoardTile {
  type: BoardItemType;
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  href: string;
  /** The artist behind the item — used for "Invite to apply". */
  artistId: string;
}

/**
 * Turn saved (item_type, item_id) pairs into tiles, in the order given. Items
 * that no longer resolve (deleted, or not visible to this client) are dropped.
 */
export async function hydrateBoardItems(
  supabase: SupabaseClient,
  items: Array<{ item_type: BoardItemType; item_id: string }>,
): Promise<BoardTile[]> {
  const ids = (t: BoardItemType) => items.filter((i) => i.item_type === t).map((i) => i.item_id);
  const artworkIds = ids("artwork");
  const updateIds = ids("update");
  const artistIds = ids("artist");

  const [artworksRes, updatesRes] = await Promise.all([
    artworkIds.length
      ? supabase
          .from("artworks")
          .select("id, title, caption, url, thumb_url, slug, creator_id, profile_id")
          .in("id", artworkIds)
      : Promise.resolve({ data: [] }),
    updateIds.length
      ? supabase
          .from("project_updates")
          .select("id, title, caption, text_content, image_url, thumb_url, project_id, artist_id")
          .in("id", updateIds)
      : Promise.resolve({ data: [] }),
  ]);

  type ArtworkRow = { id: string; title: string | null; caption: string | null; url: string | null; thumb_url: string | null; slug: string | null; creator_id: string; profile_id: string };
  type UpdateRow = { id: string; title: string | null; caption: string | null; text_content: string | null; image_url: string | null; thumb_url: string | null; project_id: string | null; artist_id: string };
  const artworks = (artworksRes.data ?? []) as ArtworkRow[];
  const updates = (updatesRes.data ?? []) as UpdateRow[];

  const profileIds = [
    ...new Set([
      ...artistIds,
      ...artworks.flatMap((a) => [a.creator_id, a.profile_id]),
      ...updates.map((u) => u.artist_id),
    ]),
  ];
  const { data: profs } = profileIds.length
    ? await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, featured_image_url, medium, city")
        .in("id", profileIds)
    : { data: [] };
  type ProfileRow = { id: string; username: string; full_name: string | null; avatar_url: string | null; featured_image_url: string | null; medium: string[] | null; city: string | null };
  const profiles = new Map(((profs ?? []) as ProfileRow[]).map((p) => [p.id, p]));
  const nameOf = (id: string) => {
    const p = profiles.get(id);
    return p ? p.full_name ?? p.username : null;
  };

  const tiles = new Map<string, BoardTile>();
  for (const a of artworks) {
    const page = profiles.get(a.profile_id);
    if (!page) continue;
    tiles.set(`artwork:${a.id}`, {
      type: "artwork",
      id: a.id,
      title: a.title ?? a.caption ?? "Untitled",
      subtitle: nameOf(a.creator_id),
      imageUrl: a.url ? gridImageSrc(a.url, a.thumb_url) ?? null : null,
      href: `/${page.username}/works/${a.slug ?? a.id}`,
      artistId: a.creator_id,
    });
  }
  for (const u of updates) {
    tiles.set(`update:${u.id}`, {
      type: "update",
      id: u.id,
      title: u.title ?? u.caption?.slice(0, 80) ?? u.text_content?.slice(0, 80) ?? "Studio update",
      subtitle: nameOf(u.artist_id),
      imageUrl: u.image_url ? gridImageSrc(u.image_url, u.thumb_url) ?? null : null,
      href: u.project_id ? `/threads/${u.project_id}?scroll=${u.id}` : `/projects/${u.id}`,
      artistId: u.artist_id,
    });
  }
  for (const id of artistIds) {
    const p = profiles.get(id);
    if (!p) continue;
    tiles.set(`artist:${id}`, {
      type: "artist",
      id,
      title: p.full_name ?? p.username,
      subtitle: [p.medium?.[0], p.city].filter(Boolean).join(" · ") || null,
      imageUrl: p.featured_image_url ?? p.avatar_url,
      href: `/${p.username}`,
      artistId: id,
    });
  }

  return items
    .map((i) => tiles.get(`${i.item_type}:${i.item_id}`))
    .filter((t): t is BoardTile => !!t);
}
