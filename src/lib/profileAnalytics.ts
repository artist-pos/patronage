import { createClient } from "@/lib/supabase/server";

export interface DayPoint {
  date: string; // "YYYY-MM-DD"
  views: number;
}

export interface ProfileStats {
  // Discovery
  profileViews30: number;
  profileViewsPrev30: number;
  cvClicks30: number;
  websiteClicks30: number;
  profileViewsTimeline: DayPoint[];
  // Engagement
  artworkViews30: number;
  followersTotal: number;
  followersGained30: number;
  // Career Activity
  opportunitiesApplied: number;
  opportunitiesSaved: number;
  worksAdded30: number;
}

export async function getProfileStats(
  profileId: string,
  days = 30
): Promise<ProfileStats> {
  const supabase = await createClient();

  const now = Date.now();
  const sinceMain = new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
  const sincePrev = new Date(now - days * 2 * 24 * 60 * 60 * 1000).toISOString();

  console.log(`[Analytics] profileId=${profileId} days=${days}`);
  console.log(`[Analytics] sinceMain=${sinceMain}  sincePrev=${sincePrev}`);

  const [
    { data: eventsAll },
    { count: followersTotal },
    { count: followersGained },
    { count: opportunitiesApplied },
    { count: opportunitiesSaved },
    { count: worksAdded },
  ] = await Promise.all([
    // Events covering current window + previous window for comparison
    supabase
      .from("analytics_events")
      .select("event_type, created_at")
      .in("event_type", ["profile_view", "cv_click", "website_click", "artwork_view"])
      .contains("payload", { profile_id: profileId })
      .gte("created_at", sincePrev),

    supabase
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq("following_id", profileId),

    supabase
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq("following_id", profileId)
      .gte("created_at", sinceMain),

    supabase
      .from("opportunity_applications")
      .select("id", { count: "exact", head: true })
      .eq("artist_id", profileId),

    supabase
      .from("user_saved_opportunities")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profileId),

    supabase
      .from("portfolio_images")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId)
      .gte("created_at", sinceMain),
  ]);

  const all = eventsAll ?? [];
  const current = all.filter((e) => e.created_at >= sinceMain);
  const prev = all.filter((e) => e.created_at < sinceMain);

  console.log(`[Analytics] events fetched: total=${all.length} current=${current.length} prev=${prev.length}`);
  const byType = (arr: typeof all) =>
    ["profile_view", "cv_click", "website_click", "artwork_view"].map(
      (t) => `${t}=${arr.filter((e) => e.event_type === t).length}`
    ).join(" ");
  console.log(`[Analytics] current: ${byType(current)}`);
  console.log(`[Analytics] prev:    ${byType(prev)}`);

  function count(arr: typeof all, type: string) {
    return arr.filter((e) => e.event_type === type).length;
  }

  // Build daily profile view timeline for the current window
  const viewsByDay = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000);
    viewsByDay.set(d.toISOString().split("T")[0], 0);
  }
  for (const e of current) {
    if (e.event_type !== "profile_view") continue;
    const key = e.created_at.split("T")[0];
    if (viewsByDay.has(key)) viewsByDay.set(key, (viewsByDay.get(key) ?? 0) + 1);
  }
  const profileViewsTimeline: DayPoint[] = Array.from(viewsByDay.entries()).map(
    ([date, views]) => ({ date, views })
  );

  return {
    profileViews30: count(current, "profile_view"),
    profileViewsPrev30: count(prev, "profile_view"),
    cvClicks30: count(current, "cv_click"),
    websiteClicks30: count(current, "website_click"),
    profileViewsTimeline,
    artworkViews30: count(current, "artwork_view"),
    followersTotal: followersTotal ?? 0,
    followersGained30: followersGained ?? 0,
    opportunitiesApplied: opportunitiesApplied ?? 0,
    opportunitiesSaved: opportunitiesSaved ?? 0,
    worksAdded30: worksAdded ?? 0,
  };
}
