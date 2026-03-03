"use server";

import { createClient } from "@/lib/supabase/server";

export async function unlistWork(workId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("portfolio_images")
    .update({ is_available: false })
    .eq("id", workId)
    .eq("creator_id", user.id);

  if (error) return { error: error.message };
  return {};
}

export async function toggleHideAvailable(workId: string, hide: boolean): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("portfolio_images")
    .update({ hide_available: hide })
    .eq("id", workId)
    .eq("creator_id", user.id);

  if (error) return { error: error.message };
  return {};
}
