"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function toggleSupportEnabled(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("support_enabled, username")
    .eq("id", user.id)
    .single();

  if (!profile) return { error: "Profile not found." };

  const { error } = await supabase
    .from("profiles")
    .update({ support_enabled: !profile.support_enabled })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath(`/${profile.username}`);
  return {};
}
