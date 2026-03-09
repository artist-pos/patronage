import { createClient } from "@/lib/supabase/server";
import type { Profile, ProfileFilters, ProfileWithImage, PortfolioImage } from "@/types/database";

export async function getProfile(username: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
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
  filters: ProfileFilters = {},
  limit?: number
): Promise<ProfileWithImage[]> {
  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("*")
    .eq("is_active", true)
    .in("role", ["artist", "owner"])
    .order("created_at", { ascending: false });

  if (filters.country) query = query.eq("country", filters.country);
  if (filters.career_stage) query = query.eq("career_stage", filters.career_stage);
  if (filters.medium) query = query.contains("medium", [filters.medium]);
  if (filters.discipline) query = query.contains("disciplines", [filters.discipline]);
  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const profiles = (data ?? []) as Profile[];

  return profiles.map((p) => ({
    ...p,
    primary_image_url: p.featured_image_url ?? null,
  }));
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
