import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, Opportunity } from "@/types/database";
import { getOpportunityById } from "@/lib/opportunities";
import { getAgeBracket } from "@/lib/constants/demographics";

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

export async function getAllProfiles(limit = 500, offset = 0): Promise<Profile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  return (data ?? []) as Profile[];
}

export async function getAllOpportunities(limit = 500, offset = 0): Promise<Opportunity[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("opportunities")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
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

// ── Impact Metrics ───────────────────────────────────────────────────────────

export interface ImpactMetrics {
  // Funding flow
  totalFundingFacilitated: number;
  fundingByType: Record<string, number>;
  fundingByRegion: Record<string, number>;
  avgFundingPerArtist: number;
  distinctArtistsFunded: number;

  // Career trajectory
  artistsFundedThroughPatronage: number;
  repeatSuccessCount: number;
  avgDaysToFirstOpportunity: number | null;

  // Economic multiplier
  artsOrgsCount: number;
  activeCountries: string[];
  activeCities: string[];
  crossBorderApps: Array<{ artistCountry: string; oppCountry: string; count: number }>;

  // Platform totals for annual report
  totalOpportunitiesTracked: number;
  totalApplicationsProcessed: number;
  artistDemographics: {
    byCareerStage: Record<string, number>;
    byCountry: Record<string, number>;
  };
}

export async function getImpactMetrics(): Promise<ImpactMetrics> {
  const admin = createAdminClient();

  // Fetch all data in parallel
  const [
    { data: approvedApps },
    { data: allOpps },
    { data: artistProfiles },
    { data: achievements },
    { count: totalApps },
  ] = await Promise.all([
    // Applications that reached approval
    admin
      .from("opportunity_applications")
      .select("opportunity_id, artist_id, status")
      .in("status", ["selected", "approved_pending_assets", "production_ready"]),
    // All published opportunities
    admin
      .from("opportunities")
      .select("id, type, country, city, funding_amount, profile_id, is_active, status"),
    // Artist profiles for demographics + cross-border
    admin
      .from("profiles")
      .select("id, country, career_stage, created_at")
      .in("role", ["artist", "owner"]),
    // Verified achievements for career trajectory
    admin
      .from("profile_achievements")
      .select("profile_id, created_at")
      .eq("verified", true),
    // Total applications processed
    admin
      .from("opportunity_applications")
      .select("*", { count: "exact", head: true }),
  ]);

  // Build lookup maps
  const oppMap = new Map<string, { type: string; country: string; city: string | null; funding_amount: number | null; profile_id: string | null }>();
  for (const o of allOpps ?? []) {
    oppMap.set(o.id, {
      type: o.type ?? "",
      country: o.country ?? "",
      city: o.city ?? null,
      funding_amount: o.funding_amount ?? null,
      profile_id: o.profile_id ?? null,
    });
  }

  const profileMap = new Map<string, { country: string | null; career_stage: string | null; created_at: string }>();
  for (const p of artistProfiles ?? []) {
    profileMap.set(p.id, { country: p.country ?? null, career_stage: p.career_stage ?? null, created_at: p.created_at });
  }

  // ── Funding flow ──────────────────────────────────────────────────────────
  const fundedOppIds = new Set<string>();
  const fundedArtistIds = new Set<string>();
  for (const app of approvedApps ?? []) {
    fundedOppIds.add(app.opportunity_id);
    fundedArtistIds.add(app.artist_id);
  }

  let totalFundingFacilitated = 0;
  const fundingByType: Record<string, number> = {};
  const fundingByRegion: Record<string, number> = {};
  for (const oppId of fundedOppIds) {
    const opp = oppMap.get(oppId);
    if (!opp?.funding_amount) continue;
    totalFundingFacilitated += opp.funding_amount;
    if (opp.type) fundingByType[opp.type] = (fundingByType[opp.type] ?? 0) + opp.funding_amount;
    if (opp.country) fundingByRegion[opp.country] = (fundingByRegion[opp.country] ?? 0) + opp.funding_amount;
  }

  const distinctArtistsFunded = fundedArtistIds.size;
  const avgFundingPerArtist = distinctArtistsFunded === 0 ? 0 : Math.round(totalFundingFacilitated / distinctArtistsFunded);

  // ── Career trajectory ─────────────────────────────────────────────────────
  const achievementsByProfile = new Map<string, string[]>(); // profile_id → [created_at, ...]
  for (const a of achievements ?? []) {
    const list = achievementsByProfile.get(a.profile_id) ?? [];
    list.push(a.created_at);
    achievementsByProfile.set(a.profile_id, list);
  }
  const artistsFundedThroughPatronage = achievementsByProfile.size;
  const repeatSuccessCount = [...achievementsByProfile.values()].filter((v) => v.length >= 2).length;

  // Average days from profile creation to first pipeline achievement
  let totalDays = 0;
  let daysCount = 0;
  for (const [profileId, dates] of achievementsByProfile) {
    const profile = profileMap.get(profileId);
    if (!profile) continue;
    const earliest = dates.reduce((a, b) => (a < b ? a : b));
    const days = Math.floor(
      (new Date(earliest).getTime() - new Date(profile.created_at).getTime()) / 864e5
    );
    if (days >= 0) { totalDays += days; daysCount++; }
  }
  const avgDaysToFirstOpportunity = daysCount === 0 ? null : Math.round(totalDays / daysCount);

  // ── Economic multiplier ───────────────────────────────────────────────────
  const activeOpps = (allOpps ?? []).filter((o) => o.status === "published" && o.is_active);
  const artsOrgProfileIds = new Set<string>();
  const activeCountriesSet = new Set<string>();
  const activeCitiesSet = new Set<string>();
  for (const o of activeOpps) {
    if (o.profile_id) artsOrgProfileIds.add(o.profile_id);
    if (o.country) activeCountriesSet.add(o.country);
    if (o.city) activeCitiesSet.add(o.city);
  }

  // Cross-border applications
  const crossBorderMap = new Map<string, number>();
  for (const app of approvedApps ?? []) {
    const opp = oppMap.get(app.opportunity_id);
    const profile = profileMap.get(app.artist_id);
    if (!opp?.country || !profile?.country || opp.country === profile.country) continue;
    const key = `${profile.country}→${opp.country}`;
    crossBorderMap.set(key, (crossBorderMap.get(key) ?? 0) + 1);
  }
  const crossBorderApps = [...crossBorderMap.entries()]
    .map(([key, count]) => {
      const [artistCountry, oppCountry] = key.split("→");
      return { artistCountry, oppCountry, count };
    })
    .sort((a, b) => b.count - a.count);

  // ── Artist demographics ───────────────────────────────────────────────────
  const byCareerStage: Record<string, number> = {};
  const byCountry: Record<string, number> = {};
  for (const p of artistProfiles ?? []) {
    if (p.career_stage) byCareerStage[p.career_stage] = (byCareerStage[p.career_stage] ?? 0) + 1;
    if (p.country) byCountry[p.country] = (byCountry[p.country] ?? 0) + 1;
  }

  return {
    totalFundingFacilitated,
    fundingByType,
    fundingByRegion,
    avgFundingPerArtist,
    distinctArtistsFunded,
    artistsFundedThroughPatronage,
    repeatSuccessCount,
    avgDaysToFirstOpportunity,
    artsOrgsCount: artsOrgProfileIds.size,
    activeCountries: [...activeCountriesSet].sort(),
    activeCities: [...activeCitiesSet].sort(),
    crossBorderApps,
    totalOpportunitiesTracked: (allOpps ?? []).length,
    totalApplicationsProcessed: totalApps ?? 0,
    artistDemographics: { byCareerStage, byCountry },
  };
}

// ── Pipeline Report ───────────────────────────────────────────────────────────

export interface PipelineReportRow {
  opportunity_id: string;
  opportunity_title: string;
  opportunity_type: string;
  opportunity_deadline: string | null;
  opportunity_organiser: string;
  funding_amount: number | null;
  application_id: string;
  application_date: string;
  application_status: string;
  artist_id: string;
  artist_name: string;
  artist_email: string;
  artist_username: string;
  artist_city: string;
  artist_country: string;
  artist_career_stage: string;
  artist_age_bracket: string;
  artist_identity_tags: string;
  artist_disciplines: string;
  artist_profile_url: string;
  artist_cv_url: string;
  submitted_image_url: string;
  custom_answers_json: string;
}

export interface PipelineReport {
  // Summary
  totalPipelineOpportunities: number;
  totalPipelineOpportunitiesThisYear: number;
  totalApplications: number;
  totalApplicationsThisYear: number;
  uniqueApplicants: number;
  artistsFunded: number;
  fundingDistributed: number;

  // Demographics
  byCareerStage: Record<string, number>;
  byAgeBracket: Record<string, number>;
  byIdentityTag: Record<string, number>;
  byCity: [string, number][];
  byCountry: Record<string, number>;
  byDiscipline: [string, number][];
  appsWithAgeData: number;
  appsWithIdentityData: number;

  // Engagement
  avgAppsPerOpportunity: number;
  avgConversionRate: number;
  totalViews: number;
  viewToAppRate: number;

  // By-month time series (last 12 months)
  applicationsByMonth: { month: string; count: number }[];

  // Follow-ups
  followupsSent: number;
  followupsCompleted: number;
  furtherOppsCount: number;
  exhibitionsCount: number;
  pressCount: number;
  communityCount: number;
  incomeBreakdown: Record<string, number>;
  testimonialCount: number;

  // For CSV export
  rows: PipelineReportRow[];
  allCustomQuestionLabels: string[];
  // raw custom_answers per application_id for CSV export
  customAnswersByAppId: Record<string, Record<string, string>>;
  // question id → label mapping per opportunity
  questionLabelsByOppId: Record<string, Record<string, string>>;
}

export async function getPipelineReport(): Promise<PipelineReport> {
  const admin = createAdminClient();

  const [
    { data: pipelineOpps },
    { data: allApps },
    { data: allFollowups },
  ] = await Promise.all([
    admin
      .from("opportunities")
      .select("id, title, type, organiser, deadline, funding_amount, view_count, created_at, profile_id, custom_fields, pipeline_config")
      .eq("routing_type", "pipeline")
      .order("created_at", { ascending: false }),
    admin
      .from("opportunity_applications")
      .select("id, opportunity_id, artist_id, status, created_at, custom_answers, submitted_image_url, artwork_id"),
    admin
      .from("artist_followups")
      .select("opportunity_id, sent_at, completed_at, further_opportunities, exhibitions, press_coverage, income_from_practice, community_projects, testimonial, testimonial_consent"),
  ]);

  const oppIds = new Set((pipelineOpps ?? []).map((o) => o.id));
  const pipelineApps = (allApps ?? []).filter((a) => oppIds.has(a.opportunity_id));

  // Fetch artist profiles + emails
  const artistIds = [...new Set(pipelineApps.map((a) => a.artist_id))];
  const [{ data: profiles }, emailResults] = await Promise.all([
    artistIds.length > 0
      ? admin
          .from("profiles")
          .select("id, username, full_name, city, country, career_stage, year_of_birth, identity_tags, medium, cv_url")
          .in("id", artistIds)
      : { data: [] },
    artistIds.length > 0
      ? Promise.all(artistIds.map((id) => admin.auth.admin.getUserById(id)))
      : Promise.resolve([]),
  ]);

  const profileMap = new Map<string, {
    username: string; full_name: string | null; city: string | null; country: string | null;
    career_stage: string | null; year_of_birth: number | null; identity_tags: string[] | null;
    medium: string[] | null; cv_url: string | null;
  }>();
  for (const p of profiles ?? []) profileMap.set(p.id, p as never);

  const emailMap = new Map<string, string>();
  for (let i = 0; i < artistIds.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const email = (emailResults as any[])[i]?.data?.user?.email;
    if (email) emailMap.set(artistIds[i], email);
  }

  // Build question label maps per opportunity
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
  const questionLabelsByOppId: Record<string, Record<string, string>> = {};
  const allCustomQuestionLabelsSet = new Set<string>();

  for (const opp of pipelineOpps ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const questions: { id: string; label: string }[] = (opp.pipeline_config as any)?.questions?.length
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (opp.pipeline_config as any).questions.map((q: any) => ({ id: q.id, label: q.label }))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : ((opp.custom_fields as any[]) ?? []).map((f: any) => ({ id: f.id, label: f.question }));
    const map: Record<string, string> = {};
    for (const q of questions) {
      map[q.id] = q.label;
      allCustomQuestionLabelsSet.add(q.label);
    }
    questionLabelsByOppId[opp.id] = map;
  }
  const allCustomQuestionLabels = [...allCustomQuestionLabelsSet];

  // Aggregate demographics
  const byCareerStage: Record<string, number> = {};
  const byAgeBracket: Record<string, number> = {};
  const byIdentityTag: Record<string, number> = {};
  const byCityMap: Record<string, number> = {};
  const byCountry: Record<string, number> = {};
  const byDisciplineMap: Record<string, number> = {};
  let appsWithAgeData = 0;
  let appsWithIdentityData = 0;

  const applicationsByMonthMap: Record<string, number> = {};
  const now = new Date();
  // Initialise last 12 months
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    applicationsByMonthMap[key] = 0;
  }

  const customAnswersByAppId: Record<string, Record<string, string>> = {};
  const rows: PipelineReportRow[] = [];
  const thisYear = now.getFullYear().toString();

  let totalApplicationsThisYear = 0;
  let artistsFunded = 0;
  let fundingDistributed = 0;
  const fundedOppIds = new Set<string>();
  const fundedArtistIds = new Set<string>();

  const oppMap = new Map<string, typeof pipelineOpps extends (infer T)[] | null ? T : never>();
  for (const o of pipelineOpps ?? []) oppMap.set(o.id, o as never);

  for (const app of pipelineApps) {
    const profile = profileMap.get(app.artist_id);
    const opp = oppMap.get(app.opportunity_id);
    if (!opp) continue;

    const appDate = new Date(app.created_at);
    const monthKey = `${appDate.getFullYear()}-${String(appDate.getMonth() + 1).padStart(2, "0")}`;
    if (monthKey in applicationsByMonthMap) applicationsByMonthMap[monthKey]++;
    if (app.created_at.startsWith(thisYear)) totalApplicationsThisYear++;

    const isFunded = ["selected", "approved_pending_assets", "production_ready"].includes(app.status);
    if (isFunded) {
      fundedArtistIds.add(app.artist_id);
      if (!fundedOppIds.has(app.opportunity_id)) {
        fundedOppIds.add(app.opportunity_id);
        if (opp.funding_amount) fundingDistributed += opp.funding_amount;
      }
    }

    // Demographics
    if (profile) {
      if (profile.career_stage) byCareerStage[profile.career_stage] = (byCareerStage[profile.career_stage] ?? 0) + 1;
      const city = [profile.city, profile.country].filter(Boolean).join(", ");
      if (city) byCityMap[city] = (byCityMap[city] ?? 0) + 1;
      if (profile.country) byCountry[profile.country] = (byCountry[profile.country] ?? 0) + 1;
      for (const m of profile.medium ?? []) byDisciplineMap[m] = (byDisciplineMap[m] ?? 0) + 1;

      const bracket = getAgeBracket(profile.year_of_birth);
      if (bracket) { byAgeBracket[bracket] = (byAgeBracket[bracket] ?? 0) + 1; appsWithAgeData++; }

      if ((profile.identity_tags ?? []).length > 0) {
        appsWithIdentityData++;
        for (const tag of profile.identity_tags ?? []) {
          byIdentityTag[tag] = (byIdentityTag[tag] ?? 0) + 1;
        }
      }
    }

    // Custom answers (store by app id for CSV export)
    const answers = (app.custom_answers ?? {}) as Record<string, string>;
    customAnswersByAppId[app.id] = answers;

    // Build CSV row
    rows.push({
      opportunity_id: app.opportunity_id,
      opportunity_title: opp.title ?? "",
      opportunity_type: opp.type ?? "",
      opportunity_deadline: opp.deadline ?? null,
      opportunity_organiser: opp.organiser ?? "",
      funding_amount: opp.funding_amount ?? null,
      application_id: app.id,
      application_date: app.created_at,
      application_status: app.status,
      artist_id: app.artist_id,
      artist_name: profile?.full_name ?? profile?.username ?? "",
      artist_email: emailMap.get(app.artist_id) ?? "",
      artist_username: profile?.username ?? "",
      artist_city: profile?.city ?? "",
      artist_country: profile?.country ?? "",
      artist_career_stage: profile?.career_stage ?? "",
      artist_age_bracket: getAgeBracket(profile?.year_of_birth ?? null) ?? "",
      artist_identity_tags: (profile?.identity_tags ?? []).join(", "),
      artist_disciplines: (profile?.medium ?? []).join("; "),
      artist_profile_url: profile?.username ? `${siteUrl}/${profile.username}` : "",
      artist_cv_url: profile?.cv_url ?? "",
      submitted_image_url: app.submitted_image_url ?? "",
      custom_answers_json: JSON.stringify(answers),
    });
  }

  artistsFunded = fundedArtistIds.size;

  // Engagement
  const totalViews = (pipelineOpps ?? []).reduce((sum, o) => sum + (o.view_count ?? 0), 0);
  const avgAppsPerOpportunity = (pipelineOpps ?? []).length === 0 ? 0 : Math.round(pipelineApps.length / (pipelineOpps ?? []).length);
  const selectedCount = pipelineApps.filter((a) => ["selected", "approved_pending_assets", "production_ready"].includes(a.status)).length;
  const avgConversionRate = pipelineApps.length === 0 ? 0 : Math.round((selectedCount / pipelineApps.length) * 100);
  const viewToAppRate = totalViews === 0 ? 0 : Math.round((pipelineApps.length / totalViews) * 100);

  // Follow-ups
  const pipelineFollowups = (allFollowups ?? []).filter((f) => oppIds.has(f.opportunity_id));
  let followupsSent = 0, followupsCompleted = 0, furtherOppsCount = 0, exhibitionsCount = 0, pressCount = 0, communityCount = 0, testimonialCount = 0;
  const incomeBreakdown: Record<string, number> = {};
  for (const f of pipelineFollowups) {
    if (f.sent_at) followupsSent++;
    if (f.completed_at) {
      followupsCompleted++;
      if (f.further_opportunities?.trim()) furtherOppsCount++;
      if (f.exhibitions?.trim()) exhibitionsCount++;
      if (f.press_coverage?.trim()) pressCount++;
      if (f.community_projects?.trim()) communityCount++;
      if (f.testimonial_consent && f.testimonial) testimonialCount++;
      if (f.income_from_practice) incomeBreakdown[f.income_from_practice] = (incomeBreakdown[f.income_from_practice] ?? 0) + 1;
    }
  }

  const applicationsByMonth = Object.entries(applicationsByMonthMap).map(([month, count]) => ({ month, count }));

  return {
    totalPipelineOpportunities: (pipelineOpps ?? []).length,
    totalPipelineOpportunitiesThisYear: (pipelineOpps ?? []).filter((o) => o.created_at.startsWith(thisYear)).length,
    totalApplications: pipelineApps.length,
    totalApplicationsThisYear,
    uniqueApplicants: artistIds.length,
    artistsFunded,
    fundingDistributed,
    byCareerStage,
    byAgeBracket,
    byIdentityTag,
    byCity: Object.entries(byCityMap).sort((a, b) => b[1] - a[1]).slice(0, 15),
    byCountry,
    byDiscipline: Object.entries(byDisciplineMap).sort((a, b) => b[1] - a[1]).slice(0, 10),
    appsWithAgeData,
    appsWithIdentityData,
    avgAppsPerOpportunity,
    avgConversionRate,
    totalViews,
    viewToAppRate,
    applicationsByMonth,
    followupsSent,
    followupsCompleted,
    furtherOppsCount,
    exhibitionsCount,
    pressCount,
    communityCount,
    incomeBreakdown,
    testimonialCount,
    rows,
    allCustomQuestionLabels,
    customAnswersByAppId,
    questionLabelsByOppId,
  };
}

export async function getAnalytics(): Promise<Analytics> {
  const supabase = await createClient();

  const [{ data: profiles }, { data: opps }, { data: artworks }] = await Promise.all([
    supabase.from("profiles").select("is_active, created_at, role"),
    supabase.from("opportunities").select("type, country, is_active, deadline"),
    supabase.from("artworks").select("is_available, creator_id, current_owner_id, price_cents"),
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
    return sum + (a.price_cents ? a.price_cents / 100 : 0);
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
