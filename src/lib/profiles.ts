import { createClient } from "@/lib/supabase/server";
import type { Profile, ProfileFilters, PortfolioImage } from "@/types/database";

export async function getProfile(username: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .eq("is_active", true)
    .single();
  return data as Profile | null;
}

export async function getProfileById(id: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();
  return data as Profile | null;
}

export async function getProfiles(
  filters: ProfileFilters = {}
): Promise<Profile[]> {
  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (filters.country) query = query.eq("country", filters.country);
  if (filters.career_stage) query = query.eq("career_stage", filters.career_stage);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Profile[];
}

export async function getPortfolioImages(
  profileId: string
): Promise<PortfolioImage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("portfolio_images")
    .select("*")
    .eq("profile_id", profileId)
    .order("position", { ascending: true });
  return (data ?? []) as PortfolioImage[];
}
