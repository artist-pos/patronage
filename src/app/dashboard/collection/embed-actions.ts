"use server";

import { createClient } from "@/lib/supabase/server";
import type { PatronEmbedConfig } from "@/types/database";

export async function saveEmbedConfig(config: PatronEmbedConfig): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ patron_embed_config: config })
    .eq("id", user.id);

  if (error) return { error: error.message };
  return {};
}
