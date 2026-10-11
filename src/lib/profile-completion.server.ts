import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { CompletionProfile } from "@/lib/profile-completion";
import { computeVerifiedProgress, type VerifiedProgress } from "@/lib/verified-progress";

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

// Verified needs a works count that the completion profile doesn't carry, so it
// is its own cached read. The studio layout and nudges share the same rule.
export const fetchVerifiedProgress = cache(async (userId: string): Promise<VerifiedProgress> => {
  const supabase = await createClient();
  const [{ data: profile }, { count }] = await Promise.all([
    supabase.from("profiles").select("bio, avatar_url").eq("id", userId).maybeSingle(),
    supabase.from("artworks").select("id", { count: "exact", head: true }).eq("profile_id", userId),
  ]);
  return computeVerifiedProgress(profile, count ?? 0);
});
