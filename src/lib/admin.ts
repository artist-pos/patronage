import { createClient } from "@/lib/supabase/server";
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
    .single();
  return data?.role === "admin";
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
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Opportunity[];
}

export interface Analytics {
  profilesActive: number;
  profilesInactive: number;
  profilesThisWeek: number;
  opportunitiesActive: number;
  opportunitiesInactive: number;
  opportunitiesExpiringSoon: number;
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

export async function getAnalytics(): Promise<Analytics> {
  const supabase = await createClient();

  const [{ data: profiles }, { data: opps }] = await Promise.all([
    supabase.from("profiles").select("is_active, created_at"),
    supabase.from("opportunities").select("type, country, is_active, deadline"),
  ]);

  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().split("T")[0];
  const weekAhead = new Date(Date.now() + 7 * 864e5).toISOString().split("T")[0];

  const profs = profiles ?? [];
  const oppsArr = opps ?? [];

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

  return {
    profilesActive: profs.filter((p) => p.is_active).length,
    profilesInactive: profs.filter((p) => !p.is_active).length,
    profilesThisWeek: profs.filter((p) => p.created_at >= weekAgo).length,
    opportunitiesActive,
    opportunitiesInactive,
    opportunitiesExpiringSoon,
    byType,
    byCountry,
  };
}
