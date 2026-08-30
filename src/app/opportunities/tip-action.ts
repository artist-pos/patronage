"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { sourceKeyForUrl } from "@/lib/opportunity-sources";

export async function submitOpportunityTip(
  name: string,
  sourceLink: string,
  email: string
): Promise<{ error?: string }> {
  if (!name.trim() || !sourceLink.trim()) {
    return { error: "Opportunity name and source link are required." };
  }

  const supabase = createAdminClient();

  // The tip's source link is by definition where the tipper saw it, so tag the
  // board when we recognise the domain. An admin can correct it in the queue.
  const sourceKey = sourceKeyForUrl(sourceLink);

  // Migration 064 merged opportunity_submissions into opportunities. Submissions
  // are now opportunities rows with status='pending' and is_active=false.
  const { error } = await supabase.from("opportunities").insert({
    title: name.trim(),
    organiser: "Community Tip",
    url: sourceLink.trim(),
    source: sourceKey,
    source_url: sourceKey ? sourceLink.trim() : null,
    submitter_email: email.trim() || null,
    type: "Grant",
    country: "NZ",
    routing_type: "external",
    custom_fields: [],
    show_badges_in_submission: false,
    status: "pending",
    is_active: false,
  });

  if (error) return { error: error.message };
  return {};
}
