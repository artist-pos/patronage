"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNudgeEmail } from "@/lib/email";
import { saveScores } from "@/app/review/actions";
import type { RubricCriterion, ApplicationScore } from "@/types/database";

async function authoriseReviewer(opportunityId: string, requireEditor = false) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const [{ data: profile }, { data: opp }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("opportunities").select("profile_id").eq("id", opportunityId).single(),
  ]);

  const isAdmin = profile?.role === "admin" || profile?.role === "owner";
  if (opp?.profile_id !== user.id && !isAdmin) {
    const { data: collab } = await supabase
      .from("opportunity_collaborators")
      .select("role")
      .eq("opportunity_id", opportunityId)
      .eq("profile_id", user.id)
      .maybeSingle();
    if (!collab || (requireEditor && collab.role !== "editor")) throw new Error("Not authorised");
  }

  return { supabase, user };
}

export async function getCriteriaForOpportunity(
  opportunityId: string
): Promise<RubricCriterion[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rubric_criteria")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .order("position");
  return (data ?? []) as RubricCriterion[];
}

export async function getScoresForApplication(
  applicationId: string
): Promise<ApplicationScore[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("application_scores")
    .select("*")
    .eq("application_id", applicationId);
  return (data ?? []) as ApplicationScore[];
}

export async function upsertScore(
  opportunityId: string,
  applicationId: string,
  criterionId: string,
  score: number,
  _note?: string
): Promise<{ error?: string }> {
  // One path for every score: range-checked and limited to assigned applications.
  return saveScores(opportunityId, applicationId, { [criterionId]: score });
}

export async function nudgeReviewer(
  opportunityId: string,
  reviewerId: string
): Promise<{ error?: string }> {
  await authoriseReviewer(opportunityId, true);

  const admin = createAdminClient();
  const [{ data: authData }, { data: opp }] = await Promise.all([
    admin.auth.admin.getUserById(reviewerId),
    admin.from("opportunities").select("title").eq("id", opportunityId).single(),
  ]);

  const email = authData?.user?.email;
  if (!email) return { error: "Reviewer email not found" };

  sendNudgeEmail({
    reviewerEmail: email,
    opportunityTitle: (opp?.title as string) ?? "your opportunity",
    opportunityId,
  }).catch(console.error);

  return {};
}
