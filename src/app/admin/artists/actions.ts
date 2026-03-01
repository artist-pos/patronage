"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { revalidatePath } from "next/cache";

async function guard() {
  if (!(await isAdmin())) throw new Error("Not authorised");
}

export async function toggleArtistActive(id: string, current: boolean) {
  await guard();
  const supabase = await createClient();
  await supabase.from("profiles").update({ is_active: !current }).eq("id", id);
  revalidatePath("/admin/artists");
}

export async function togglePatronageSupported(id: string, current: boolean) {
  await guard();
  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ is_patronage_supported: !current })
    .eq("id", id);
  revalidatePath("/admin/artists");
}

export async function deleteArtist(id: string) {
  await guard();
  const supabase = await createClient();
  // Delete portfolio images from storage first
  const { data: imgs } = await supabase
    .from("portfolio_images")
    .select("url")
    .eq("profile_id", id);
  if (imgs && imgs.length > 0) {
    const paths = imgs.map((i: { url: string }) => {
      const parts = i.url.split("/portfolio/");
      return parts[1] ?? "";
    }).filter(Boolean);
    if (paths.length > 0) {
      await supabase.storage.from("portfolio").remove(paths);
    }
  }
  await supabase.from("profiles").delete().eq("id", id);
  revalidatePath("/admin/artists");
}
