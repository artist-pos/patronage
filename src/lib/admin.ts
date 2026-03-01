import { createClient } from "@/lib/supabase/server";
import type { Profile, Opportunity } from "@/types/database";

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
