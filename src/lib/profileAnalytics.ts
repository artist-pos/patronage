import { createClient } from "@/lib/supabase/server";

export interface ProfileStats {
  // Discovery
  profileViews30: number;
  profileViewsPrev30: number;
  cvClicks30: number;
  websiteClicks30: number;
  // Engagement
  artworkViews30: number;
  followersTotal: number;
  followersGained30: number;
  // Career Activity
  opportunitiesApplied: number;
  opportunitiesSaved: number;
  worksAdded30: number;
}

export async function getProfileStats(profileId: string): Promise<ProfileStats> {
  const supabase = await createClient();

  const now = Date.now();
  const since30 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const since60 = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: events60 },
    { count: followersTotal },
    { count: followersGained30 },
    { count: opportunitiesApplied },
    { count: opportunitiesSaved },
    { count: worksAdded30 },
  ] = await Promise.all([
    // All tracked events for this profile over the last 60 days (covers current + prev window)
    supabase
      .from("analytics_events")
      .select("event_type, created_at")
      .in("event_type", ["profile_view", "cv_click", "website_click", "artwork_view"])
      .contains("payload", { profile_id: profileId })
      .gte("created_at", since60),

    // All-time follower count
    supabase
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq("following_id", profileId),

    // New followers last 30 days
    supabase
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq("following_id", profileId)
      .gte("created_at", since30),

    // Opportunities applied (all-time, via pipeline)
    supabase
      .from("opportunity_applications")
      .select("id", { count: "exact", head: true })
      .eq("artist_id", profileId),

    // Opportunities saved or marked applied (all-time)
    supabase
      .from("user_saved_opportunities")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profileId),

    // New artworks added to portfolio in last 30 days
    supabase
      .from("artworks")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", profileId)
      .gte("created_at", since30),
  ]);

  const all = events60 ?? [];
  const current = all.filter((e) => e.created_at >= since30);
  const prev = all.filter((e) => e.created_at < since30);

  function count(arr: typeof all, type: string) {
    return arr.filter((e) => e.event_type === type).length;
  }

  return {
    profileViews30: count(current, "profile_view"),
    profileViewsPrev30: count(prev, "profile_view"),
    cvClicks30: count(current, "cv_click"),
    websiteClicks30: count(current, "website_click"),
    artworkViews30: count(current, "artwork_view"),
    followersTotal: followersTotal ?? 0,
    followersGained30: followersGained30 ?? 0,
    opportunitiesApplied: opportunitiesApplied ?? 0,
    opportunitiesSaved: opportunitiesSaved ?? 0,
    worksAdded30: worksAdded30 ?? 0,
  };
}
