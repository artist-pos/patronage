import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, Opportunity } from "@/types/database";
import { getOpportunityById } from "@/lib/opportunities";

export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return data?.role === "admin" || data?.role === "owner";
}

export async function getAllProfiles(): Promise<Profile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Profile[];
}

export async function getAllOpportunities(): Promise<Opportunity[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("opportunities")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Opportunity[];
}

export interface Analytics {
  profilesActive: number;
  profilesInactive: number;
  profilesThisWeek: number;
  artistCount: number;
  patronCount: number;
  partnerCount: number;
  opportunitiesActive: number;
  opportunitiesInactive: number;
  opportunitiesExpiringSoon: number;
  transferCount: number;
  transferValue: number;
  byType: Record<string, number>;
  byCountry: Record<string, number>;
}

export interface GrantPerformance {
  opportunity_id: string;
  title: string;
  organiser: string;
  engagements: number;
  clicks: number;
}

export async function getGrantPerformance(): Promise<GrantPerformance[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("analytics_events")
    .select("event_type, payload")
    .in("event_type", ["opportunity_engagement", "opportunity_click"])
    .gte("created_at", since);

  const map = new Map<string, GrantPerformance>();
  for (const e of data ?? []) {
    const id = e.payload?.opportunity_id;
    if (!id) continue;
    if (!map.has(id)) {
      map.set(id, {
        opportunity_id: id,
        title: e.payload?.title ?? "",
        organiser: e.payload?.organiser ?? "",
        engagements: 0,
        clicks: 0,
      });
    }
    const entry = map.get(id)!;
    if (e.event_type === "opportunity_engagement") entry.engagements++;
    if (e.event_type === "opportunity_click") entry.clicks++;
  }
  return [...map.values()].sort((a, b) => b.clicks + b.engagements - (a.clicks + a.engagements));
}

export interface MediumTrend { medium: string; count: number }

export async function getMediumTrends(): Promise<MediumTrend[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("analytics_events")
    .select("payload")
    .eq("event_type", "medium_filter")
    .gte("created_at", since);

  const counts = new Map<string, number>();
  for (const e of data ?? []) {
    const medium = e.payload?.medium;
    if (medium) counts.set(medium, (counts.get(medium) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([medium, count]) => ({ medium, count }))
    .sort((a, b) => b.count - a.count);
}

export interface GrantReport {
  opportunity: Opportunity;
  last30: { engagements: number; clicks: number };
  allTime: { engagements: number; clicks: number };
}

export async function getGrantReport(opportunityId: string): Promise<GrantReport | null> {
  const supabase = await createClient();
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [opp, { data: allEvents }] = await Promise.all([
    getOpportunityById(opportunityId),
    supabase
      .from("analytics_events")
      .select("event_type, created_at, payload")
      .in("event_type", ["opportunity_engagement", "opportunity_click"]),
  ]);

  if (!opp) return null;

  const relevant = (allEvents ?? []).filter(
    (e) => e.payload?.opportunity_id === opportunityId
  );
  const recent = relevant.filter((e) => e.created_at >= since30);

  return {
    opportunity: opp,
    last30: {
      engagements: recent.filter((e) => e.event_type === "opportunity_engagement").length,
      clicks: recent.filter((e) => e.event_type === "opportunity_click").length,
    },
    allTime: {
      engagements: relevant.filter((e) => e.event_type === "opportunity_engagement").length,
      clicks: relevant.filter((e) => e.event_type === "opportunity_click").length,
    },
  };
}

// ── New metric functions ─────────────────────────────────────────────────────

export interface ArtistQuality {
  totalArtists: number;
  verifiedCount: number;
  verifiedPercent: number;
  verifiedThisWeek: number;
  verifiedThisMonth: number;
  avgCompletionPercent: number;
}

export async function getArtistQualityMetrics(): Promise<ArtistQuality> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select(`
      id, avatar_url, featured_image_url, bio, disciplines, country,
      career_stage, website_url, instagram_handle, cv_url, created_at, verified_at,
      portfolio_images(count), artworks(count)
    `)
    .in("role", ["artist", "owner"]);

  const rows = data ?? [];
  const now = Date.now();
  const weekAgo = new Date(now - 7 * 864e5).toISOString();
  const monthAgo = new Date(now - 30 * 864e5).toISOString();

  let verifiedCount = 0;
  let verifiedThisWeek = 0;
  let verifiedThisMonth = 0;
  let totalCompletion = 0;

  for (const row of rows) {
    const portfolioCount =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((row.portfolio_images as any)?.[0]?.count ?? 0) +
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((row.artworks as any)?.[0]?.count ?? 0);

    const disciplineLen = (row.disciplines as string[] | null | undefined)?.length ?? 0;
    const isVerified =
      !!row.bio &&
      !!row.avatar_url &&
      disciplineLen > 0 &&
      portfolioCount >= 3;

    if (isVerified) {
      verifiedCount++;
      if (row.verified_at >= weekAgo) verifiedThisWeek++;
      if (row.verified_at >= monthAgo) verifiedThisMonth++;
    }

    // 11-point completion score
    const score = [
      !!row.avatar_url,
      !!row.featured_image_url,
      !!row.bio,
      disciplineLen > 0,
      !!row.country,
      !!row.career_stage,
      !!row.website_url,
      !!row.instagram_handle,
      !!row.cv_url,
      portfolioCount >= 1,
      portfolioCount >= 3,
    ].filter(Boolean).length;
    totalCompletion += score / 11;
  }

  const totalArtists = rows.length;
  return {
    totalArtists,
    verifiedCount,
    verifiedPercent: totalArtists === 0 ? 0 : Math.round((verifiedCount / totalArtists) * 100),
    verifiedThisWeek,
    verifiedThisMonth,
    avgCompletionPercent: totalArtists === 0 ? 0 : Math.round((totalCompletion / totalArtists) * 100),
  };
}

export interface RetentionMetrics {
  wau: number;
  mau: number;
  wauMauRatio: number;
}

export async function getRetentionMetrics(): Promise<RetentionMetrics> {
  const admin = createAdminClient();
  const now = Date.now();
  const weekAgo = new Date(now - 7 * 864e5).toISOString();
  const monthAgo = new Date(now - 30 * 864e5).toISOString();

  async function fetchIds(
    table: string,
    column: string,
    since: string
  ): Promise<string[]> {
    // TODO: migrate to RPC at scale — .limit(10000) is a stopgap
    const { data } = await admin
      .from(table)
      .select(column)
      .gte("created_at", since)
      .limit(10000);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((r: any) => r[column] as string).filter(Boolean);
  }

  const sources: [string, string][] = [
    ["user_saved_opportunities", "user_id"],
    ["artworks", "profile_id"],
    ["portfolio_images", "profile_id"],
    ["project_updates", "artist_id"],
    ["messages", "sender_id"],
    ["opportunity_applications", "artist_id"],
  ];

  const [wauResults, mauResults] = await Promise.all([
    Promise.all(sources.map(([t, c]) => fetchIds(t, c, weekAgo))),
    Promise.all(sources.map(([t, c]) => fetchIds(t, c, monthAgo))),
  ]);

  const wauSet = new Set(wauResults.flat());
  const mauSet = new Set(mauResults.flat());
  const wau = wauSet.size;
  const mau = mauSet.size;

  return {
    wau,
    mau,
    wauMauRatio: mau === 0 ? 0 : Math.round((wau / mau) * 100),
  };
}

export interface OpportunityEngagement {
  avgSavesPerOpportunity: number;
  clickThroughRate: number;
  pipelineAppsAllTime: number;
  pipelineAppsLast30: number;
  pipelineCompletionRate: number;
}

export async function getOpportunityEngagement(): Promise<OpportunityEngagement> {
  const admin = createAdminClient();
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString();

  const [
    { count: saveCount },
    { count: publishedCount },
    { data: oppData },
    { count: appsAllTime },
    { count: appsLast30 },
    { data: drafts },
    { data: applications },
    { data: clickEvents },
  ] = await Promise.all([
    admin.from("user_saved_opportunities").select("*", { count: "exact", head: true }),
    admin.from("opportunities").select("*", { count: "exact", head: true }).eq("status", "published"),
    admin.from("opportunities").select("view_count").eq("status", "published"),
    admin.from("opportunity_applications").select("*", { count: "exact", head: true }),
    admin
      .from("opportunity_applications")
      .select("*", { count: "exact", head: true })
      .gte("created_at", monthAgo),
    admin.from("opportunity_application_drafts").select("opportunity_id, artist_id"),
    admin.from("opportunity_applications").select("opportunity_id, artist_id"),
    admin
      .from("analytics_events")
      .select("payload")
      .eq("event_type", "opportunity_click"),
  ]);

  const totalViewCount = (oppData ?? []).reduce(
    (sum, o) => sum + (o.view_count ?? 0),
    0
  );
  const totalClicks = (clickEvents ?? []).length;
  const clickThroughRate =
    totalViewCount === 0 ? 0 : Math.round((totalClicks / totalViewCount) * 100);

  // Pipeline completion rate
  const submittedPairs = new Set(
    (applications ?? []).map((a) => `${a.opportunity_id}:${a.artist_id}`)
  );
  const orphanDrafts = (drafts ?? []).filter(
    (d) => !submittedPairs.has(`${d.opportunity_id}:${d.artist_id}`)
  ).length;
  const appCount = appsAllTime ?? 0;
  const pipelineCompletionRate =
    appCount + orphanDrafts === 0
      ? 0
      : Math.round((appCount / (appCount + orphanDrafts)) * 100);

  const pubCount = publishedCount ?? 0;
  return {
    avgSavesPerOpportunity:
      pubCount === 0 ? 0 : Math.round(((saveCount ?? 0) / pubCount) * 10) / 10,
    clickThroughRate,
    pipelineAppsAllTime: appCount,
    pipelineAppsLast30: appsLast30 ?? 0,
    pipelineCompletionRate,
  };
}

export interface PartnerHealth {
  activeListers: number;
  repeatListers: number;
  pipelineAdoptionRate: number;
}

export async function getPartnerHealth(): Promise<PartnerHealth> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("opportunities")
    .select("profile_id, routing_type, is_active")
    .not("profile_id", "is", null);

  const rows = data ?? [];
  const activeProfileIds = new Set(
    rows.filter((r) => r.is_active).map((r) => r.profile_id)
  );
  const profileCounts = new Map<string, number>();
  for (const r of rows) {
    if (!r.profile_id) continue;
    profileCounts.set(r.profile_id, (profileCounts.get(r.profile_id) ?? 0) + 1);
  }

  const pipelineRows = rows.filter((r) => r.routing_type === "pipeline").length;

  return {
    activeListers: activeProfileIds.size,
    repeatListers: [...profileCounts.values()].filter((c) => c > 1).length,
    pipelineAdoptionRate:
      rows.length === 0 ? 0 : Math.round((pipelineRows / rows.length) * 100),
  };
}

export interface GrowthMetrics {
  subscriberCount: number;
  signupsThisWeekByRole: Record<string, number>;
  signupsThisMonthByRole: Record<string, number>;
}

export async function getGrowthMetrics(): Promise<GrowthMetrics> {
  const admin = createAdminClient();
  const now = Date.now();
  const weekAgo = new Date(now - 7 * 864e5).toISOString();
  const monthAgo = new Date(now - 30 * 864e5).toISOString();

  const [{ count: subscriberCount }, { data: recentProfiles }] = await Promise.all([
    admin.from("subscribers").select("*", { count: "exact", head: true }),
    admin
      .from("profiles")
      .select("role, created_at")
      .gte("created_at", monthAgo),
  ]);

  const roles = ["artist", "owner", "patron", "partner"];
  const signupsThisWeekByRole: Record<string, number> = {};
  const signupsThisMonthByRole: Record<string, number> = {};

  for (const role of roles) {
    signupsThisWeekByRole[role] = 0;
    signupsThisMonthByRole[role] = 0;
  }

  for (const p of recentProfiles ?? []) {
    const role = p.role as string;
    if (!roles.includes(role)) continue;
    signupsThisMonthByRole[role] = (signupsThisMonthByRole[role] ?? 0) + 1;
    if (p.created_at >= weekAgo) {
      signupsThisWeekByRole[role] = (signupsThisWeekByRole[role] ?? 0) + 1;
    }
  }

  return {
    subscriberCount: subscriberCount ?? 0,
    signupsThisWeekByRole,
    signupsThisMonthByRole,
  };
}

export async function getAnalytics(): Promise<Analytics> {
  const supabase = await createClient();

  const [{ data: profiles }, { data: opps }, { data: artworks }] = await Promise.all([
    supabase.from("profiles").select("is_active, created_at, role"),
    supabase.from("opportunities").select("type, country, is_active, deadline"),
    supabase.from("artworks").select("is_available, creator_id, current_owner_id, price"),
  ]);

  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().split("T")[0];
  const weekAhead = new Date(Date.now() + 7 * 864e5).toISOString().split("T")[0];

  const profs = profiles ?? [];
  const oppsArr = opps ?? [];
  const artworksArr = artworks ?? [];

  const byType: Record<string, number> = {};
  const byCountry: Record<string, number> = {};
  let opportunitiesActive = 0;
  let opportunitiesInactive = 0;
  let opportunitiesExpiringSoon = 0;

  for (const o of oppsArr) {
    const live = o.is_active && (!o.deadline || o.deadline >= today);
    if (live) opportunitiesActive++;
    else opportunitiesInactive++;
    if (live && o.deadline && o.deadline <= weekAhead) opportunitiesExpiringSoon++;
    if (o.type) byType[o.type] = (byType[o.type] ?? 0) + 1;
    if (o.country) byCountry[o.country] = (byCountry[o.country] ?? 0) + 1;
  }

  const transferred = artworksArr.filter(
    (a) => !a.is_available && a.current_owner_id !== a.creator_id
  );
  const transferValue = transferred.reduce((sum, a) => {
    if (!a.price) return sum;
    const n = parseFloat(a.price.replace(/[^0-9.]/g, ""));
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  return {
    profilesActive: profs.filter((p) => p.is_active).length,
    profilesInactive: profs.filter((p) => !p.is_active).length,
    profilesThisWeek: profs.filter((p) => p.created_at >= weekAgo).length,
    artistCount: profs.filter((p) => p.role === "artist" || p.role === "owner").length,
    patronCount: profs.filter((p) => p.role === "patron").length,
    partnerCount: profs.filter((p) => p.role === "partner").length,
    opportunitiesActive,
    opportunitiesInactive,
    opportunitiesExpiringSoon,
    transferCount: transferred.length,
    transferValue,
    byType,
    byCountry,
  };
}
