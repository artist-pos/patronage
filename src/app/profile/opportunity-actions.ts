"use server";

import { createClient } from "@/lib/supabase/server";
import { isOrgMember } from "@/lib/partner-org";

export async function deleteOpportunity(oppId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: opp } = await supabase.from("opportunities").select("profile_id").eq("id", oppId).maybeSingle();
  if (!opp || !(await isOrgMember(supabase, user.id, opp.profile_id))) return { error: "Not authorised" };

  // Never silently destroy applications: archive instead.
  const { count } = await supabase
    .from("opportunity_applications")
    .select("id", { count: "exact", head: true })
    .eq("opportunity_id", oppId);
  if ((count ?? 0) > 0) {
    return { error: "This opportunity has applications, so it can't be deleted. Archive it from its dashboard instead." };
  }

  const { error } = await supabase
    .from("opportunities")
    .delete()
    .eq("id", oppId)
    .eq("profile_id", opp.profile_id);

  if (error) return { error: error.message };
  return {};
}
