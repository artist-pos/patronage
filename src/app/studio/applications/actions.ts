"use server";

import { createClient } from "@/lib/supabase/server";

export async function submitDocumentation(
  applicationId: string,
  data: Record<string, string>
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify the calling user owns this application
  const { data: app } = await supabase
    .from("opportunity_applications")
    .select("id, artist_id")
    .eq("id", applicationId)
    .single();

  if (!app) return { error: "Application not found" };
  if ((app as { artist_id: string }).artist_id !== user.id) return { error: "Not authorised" };

  const { error } = await supabase
    .from("opportunity_applications")
    .update({ documentation: data })
    .eq("id", applicationId);

  if (error) return { error: error.message };
  return {};
}
