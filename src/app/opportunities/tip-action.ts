"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function submitOpportunityTip(
  name: string,
  sourceLink: string,
  email: string
): Promise<{ error?: string }> {
  if (!name.trim() || !sourceLink.trim()) {
    return { error: "Opportunity name and source link are required." };
  }

  const supabase = createAdminClient();

  const { error } = await supabase.from("opportunity_submissions").insert({
    title: name.trim(),
    organiser: "Community Tip",
    url: sourceLink.trim(),
    submitter_email: email.trim() || null,
    type: "Grant",
    country: "NZ",
    routing_type: "external",
    custom_fields: [],
    show_badges_in_submission: false,
  });

  if (error) return { error: error.message };
  return {};
}
