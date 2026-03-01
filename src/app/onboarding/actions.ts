"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    username,
    full_name,
    bio,
    country: country || null,
    career_stage: career_stage || null,
    medium: medium.length > 0 ? medium : null,
  });

  if (error) return { error: error.message };

  redirect(`/${username}`);
}
