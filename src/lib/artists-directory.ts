import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { gridImageSrc } from "@/lib/image";
import type { WorkPreview } from "@/components/artists/ArtistCard";

// ── Cached directory extras — identical for every visitor, revalidated every
// 5 min. Replaces two unbounded full-table artworks fetches per request.
export const getCachedDirectoryData = unstable_cache(
  async (today: string) => {
    const supabase = createPublicClient();
    const [collectedResult, worksCountResult, blogSpotlightResult, profileSpotlightResult] =
      await Promise.all([
        // IDs of artists who have had at least one work transferred.
        // PostgREST can't compare two columns in a filter — fetch both and
        // compare in JS (a literal "creator_id" string was a uuid cast error).
        supabase.from("artworks").select("creator_id, current_owner_id"),
        // Works per artist profile: counts, plus the first three the artist
        // still holds (same rule as their public Work tab) for row previews.
        supabase
          .from("artworks")
          .select("profile_id, creator_id, current_owner_id, url, thumb_url, title, position, hide_from_archive")
          .order("position", { ascending: true }),
        // Fallback spotlight from blog posts (legacy mechanism)
        supabase
          .from("blog_posts")
          .select("featured_profile_id")
          .eq("status", "published")
          .not("featured_profile_id", "is", null)
          .gte("spotlight_until", today)
          .order("spotlight_until", { ascending: false })
          .limit(1)
          .maybeSingle(),
        // Admin-set spotlight (profiles.spotlight_until) — takes precedence
        supabase
          .from("profiles")
          .select("id")
          .gte("spotlight_until", today)
          .order("spotlight_until", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    const collectedIds = [...new Set(
      (collectedResult.data ?? [])
        .filter((r: { creator_id: string | null; current_owner_id: string | null }) =>
          r.creator_id && r.current_owner_id && r.current_owner_id !== r.creator_id)
        .map((r: { creator_id: string | null }) => r.creator_id as string)
    )];

    const worksCounts: Record<string, number> = {};
    const worksPreviews: Record<string, WorkPreview[]> = {};
    for (const row of worksCountResult.data ?? []) {
      const r = row as {
        profile_id: string;
        creator_id: string | null;
        current_owner_id: string | null;
        url: string;
        thumb_url: string | null;
        title: string | null;
        hide_from_archive: boolean | null;
      };
      worksCounts[r.profile_id] = (worksCounts[r.profile_id] ?? 0) + 1;
      const shownOnProfile =
        !r.hide_from_archive && r.creator_id === r.profile_id && r.current_owner_id === r.profile_id;
      const list = (worksPreviews[r.profile_id] ??= []);
      const src = gridImageSrc(r.url, r.thumb_url);
      if (shownOnProfile && src && list.length < 3) {
        list.push({ src, title: r.title });
      }
    }

    return {
      collectedIds,
      worksCounts,
      worksPreviews,
      spotlightProfileId:
        profileSpotlightResult.data?.id ??
        blogSpotlightResult.data?.featured_profile_id ??
        null,
    };
  },
  ["artists-directory-v2"],
  { revalidate: 300, tags: ["artists-directory"] }
);
