import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { CompletionProfile } from "@/lib/profile-completion";

// React.cache() deduplicates within a single server render pass — both
// StudioPageShell and studio/page.tsx call this with the same userId.
export const fetchCompletionProfile = cache(async (userId: string): Promise<CompletionProfile | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("avatar_url, full_name, bio, disciplines, city")
    .eq("id", userId)
    .single();
  return data as CompletionProfile | null;
});
