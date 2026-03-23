"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { INCOME_CHANGE_OPTIONS } from "@/lib/constants/demographics";

export interface FollowupFormState {
  error?: string;
  success?: boolean;
}

export async function submitFollowup(
  followupId: string,
  _prev: FollowupFormState,
  formData: FormData
): Promise<FollowupFormState> {
  const admin = createAdminClient();

  // Verify followup exists and is not already completed
  const { data: followup, error: fetchError } = await admin
    .from("artist_followups")
    .select("id, completed_at")
    .eq("id", followupId)
    .single();

  if (fetchError || !followup) return { error: "Follow-up not found." };
  if (followup.completed_at) return { error: "This follow-up has already been submitted." };

  const further_opportunities = (formData.get("further_opportunities") as string)?.trim() || null;
  const exhibitions = (formData.get("exhibitions") as string)?.trim() || null;
  const press_coverage = (formData.get("press_coverage") as string)?.trim() || null;
  const income_from_practice = (formData.get("income_from_practice") as string) || null;
  const community_projects = (formData.get("community_projects") as string)?.trim() || null;
  const testimonial = (formData.get("testimonial") as string)?.trim() || null;
  const testimonial_consent = formData.get("testimonial_consent") === "on";
  const additional_notes = (formData.get("additional_notes") as string)?.trim() || null;

  // Validate income_from_practice if provided
  if (income_from_practice && !(INCOME_CHANGE_OPTIONS as readonly string[]).includes(income_from_practice)) {
    return { error: "Invalid income change option." };
  }

  const { error } = await admin
    .from("artist_followups")
    .update({
      further_opportunities,
      exhibitions,
      press_coverage,
      income_from_practice,
      community_projects,
      testimonial: testimonial_consent ? testimonial : null,
      testimonial_consent,
      additional_notes,
      completed_at: new Date().toISOString(),
    })
    .eq("id", followupId);

  if (error) return { error: error.message };

  return { success: true };
}
