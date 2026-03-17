"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function maybeSetVerifiedAt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  role: string | null,
  bio: string | null,
  avatarUrl: string | null,
  disciplines: string[]
) {
  if (role !== "artist" && role !== "owner") return;

  // Check existing verified_at — avoid overwriting
  const { data: existing } = await supabase
    .from("profiles")
    .select("verified_at")
    .eq("id", userId)
    .maybeSingle();
  if (existing?.verified_at) return;

  if (!bio || !avatarUrl || disciplines.length === 0) return;

  const { count: portfolioCount } = await supabase
    .from("portfolio_images")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", userId);
  const { count: artworkCount } = await supabase
    .from("artworks")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", userId);

  if ((portfolioCount ?? 0) + (artworkCount ?? 0) >= 3) {
    await supabase
      .from("profiles")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", userId);
  }
}

export interface ProfileFormState {
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
}

export async function upsertProfileAction(
  _prev: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated." };

  const username = (formData.get("username") as string)?.trim().toLowerCase();
  const full_name = (formData.get("full_name") as string)?.trim() || null;
  const bio = (formData.get("bio") as string)?.trim() || null;
  const country = (formData.get("country") as string) || null;
  const career_stage = (formData.get("career_stage") as string) || null;
  const mediumRaw = (formData.get("medium") as string) ?? "";
  const medium = mediumRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const disciplinesRaw = (formData.get("disciplines") as string) ?? "";
  const disciplines = disciplinesRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const website_url = (formData.get("website_url") as string)?.trim() || null;
  const instagram_handle = (formData.get("instagram_handle") as string)?.trim().replace(/^@/, "") || null;

  // Validate username
  if (!username) return { fieldErrors: { username: "Username is required." } };
  if (!/^[a-z0-9_-]{3,30}$/.test(username))
    return {
      fieldErrors: {
        username:
          "3–30 characters, lowercase letters, numbers, hyphens and underscores only.",
      },
    };

  // Check username uniqueness (excluding self)
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .neq("id", user.id)
    .maybeSingle();

  if (existing) return { fieldErrors: { username: "Username already taken." } };

  const profileData: Record<string, unknown> = {
    id: user.id,
    username,
    full_name,
    bio,
    country: country || null,
    career_stage: career_stage || null,
    medium: medium.length > 0 ? medium : null,
    website_url,
    instagram_handle,
  };
  // Only write disciplines when values are present — omitting it avoids
  // triggering the NOT NULL constraint for partners/patrons who don't
  // have a DisciplineInput in their form.
  if (disciplines.length > 0) {
    profileData.disciplines = disciplines;
  }

  const { error } = await supabase.from("profiles").upsert(profileData);

  if (error) return { error: error.message };

  // Check if this artist has just become verified for the first time
  const { data: savedProfile } = await supabase
    .from("profiles")
    .select("role, avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  await maybeSetVerifiedAt(
    supabase,
    user.id,
    savedProfile?.role ?? null,
    bio,
    savedProfile?.avatar_url ?? null,
    disciplines
  );

  redirect(`/${username}`);
}
