"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

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
