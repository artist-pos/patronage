"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { isOrgCategory } from "@/lib/org-categories";

/**
 * Changes what an organisation does (gallery, art society, regional arts body...).
 * Admin only, partners only, and the value must be one of the known categories.
 * Existing roster entries are left alone: they stay linked, but only a category
 * that keeps a roster can add to them.
 */
export async function setOrgCategory(
  id: string,
  category: string | null
): Promise<{ error?: string }> {
  if (!(await isAdmin())) return { error: "Not authorised." };
  if (category !== null && !isOrgCategory(category)) return { error: "Unknown organisation type." };

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, username")
    .eq("id", id)
    .maybeSingle();
  if (!profile) return { error: "Profile not found." };
  if (profile.role !== "partner") return { error: "Only organisations have a type." };

  const { error } = await supabase.from("profiles").update({ org_category: category }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/artists");
  revalidatePath(`/${profile.username}`);
  revalidatePath("/artists/[slug]", "page");
  return {};
}

// Text fields an admin fills in on someone's behalf, mostly to prefill a
// shadow profile before its claim link goes out. Images are handled by the
// existing uploaders, which take a profile id.
export async function updateProfileBasics(
  id: string,
  input: { full_name: string; bio: string; website_url: string; username: string }
): Promise<{ error?: string; username?: string }> {
  if (!(await isAdmin())) return { error: "Not authorised." };

  const full_name = input.full_name.trim();
  if (!full_name) return { error: "Name is required." };

  // Same rule as the artist's own handle step (onboarding/profile/actions.ts).
  const username = input.username.trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,30}$/.test(username)) {
    return { error: "The URL needs 3–30 characters: lowercase letters, numbers, hyphens and underscores." };
  }

  let website_url: string | null = input.website_url.trim() || null;
  if (website_url) {
    if (!/^https?:\/\//i.test(website_url)) website_url = `https://${website_url}`;
    try {
      new URL(website_url);
    } catch {
      return { error: "That website address is not valid." };
    }
  }

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", id)
    .maybeSingle();
  if (!current) return { error: "Profile not found." };

  if (username !== current.username) {
    const { data: taken } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .neq("id", id)
      .maybeSingle();
    if (taken) return { error: "That URL is already taken." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name, bio: input.bio.trim() || null, website_url, username })
    .eq("id", id);

  if (error) return { error: error.code === "23505" ? "That URL is already taken." : error.message };

  revalidatePath("/admin/artists");
  revalidatePath(`/${current.username}`);
  revalidatePath(`/${username}`);
  revalidatePath("/artists/[slug]", "page");
  return { username };
}
