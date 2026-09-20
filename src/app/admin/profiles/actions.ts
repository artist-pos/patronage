"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

// Text fields an admin fills in on someone's behalf, mostly to prefill a
// shadow profile before its claim link goes out. Images are handled by the
// existing uploaders, which take a profile id.
export async function updateProfileBasics(
  id: string,
  input: { full_name: string; bio: string; website_url: string }
): Promise<{ error?: string }> {
  if (!(await isAdmin())) return { error: "Not authorised." };

  const full_name = input.full_name.trim();
  if (!full_name) return { error: "Name is required." };

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
  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name, bio: input.bio.trim() || null, website_url })
    .eq("id", id)
    .select("username")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Profile not found." };

  revalidatePath("/admin/artists");
  revalidatePath(`/${data.username}`);
  revalidatePath("/artists/[slug]", "page");
  return {};
}
