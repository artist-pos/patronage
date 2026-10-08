"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { readReviewConfig } from "@/lib/review-scoring";
import { rebalanceAssignments } from "@/lib/review-assignment";
import type { PipelineConfig } from "@/types/database";

/**
 * Save one reviewer's scores for one application. Every criterion is checked
 * against the opportunity's rubric, and in "split" or "manual" mode a reviewer
 * can only score the applications assigned to them.
 */
export async function saveScores(
  opportunityId: string,
  applicationId: string,
  scores: Record<string, number>,
): Promise<{ error?: string }> {
  const { supabase, user } = await getServerUser();
  if (!user) return { error: "Please sign in again." };

  const [{ data: profile }, { data: opp }, { data: app }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("opportunities").select("id, profile_id, pipeline_config").eq("id", opportunityId).single(),
    supabase.from("opportunity_applications").select("id").eq("id", applicationId).eq("opportunity_id", opportunityId).maybeSingle(),
  ]);
  if (!opp || !app) return { error: "Application not found." };

  const isAdmin = profile?.role === "admin" || profile?.role === "owner";
  const isOwner = isAdmin || opp.profile_id === user.id;
  if (!isOwner) {
    const { data: collab } = await supabase
      .from("opportunity_collaborators")
      .select("role")
      .eq("opportunity_id", opportunityId)
      .eq("profile_id", user.id)
      .maybeSingle();
    if (!collab || collab.role !== "editor") return { error: "You have view-only access, so you can't score." };
  }

  const admin = createAdminClient();

  // Someone who has stepped back from an application can't score it.
  const { data: stepped } = await admin
    .from("application_recusals")
    .select("application_id")
    .eq("application_id", applicationId)
    .eq("reviewer_id", user.id)
    .maybeSingle();
  if (stepped) return { error: "You've stepped back from this application." };

  const config = readReviewConfig(opp.pipeline_config as PipelineConfig | null);
  if (!isOwner && config.assignment_mode !== "all") {
    const { data: assigned } = await admin
      .from("application_assignments")
      .select("application_id")
      .eq("application_id", applicationId)
      .eq("reviewer_id", user.id)
      .maybeSingle();
    if (!assigned) return { error: "This application isn't assigned to you." };
  }

  const { data: criteria } = await admin
    .from("rubric_criteria")
    .select("id, scale_max")
    .eq("opportunity_id", opportunityId);
  const byId = new Map((criteria ?? []).map((c) => [c.id as string, c.scale_max as number]));

  const rows: Array<{ application_id: string; criterion_id: string; reviewer_id: string; score: number; updated_at: string }> = [];
  for (const [criterionId, value] of Object.entries(scores)) {
    const max = byId.get(criterionId);
    if (!max) return { error: "That criterion isn't part of this rubric." };
    if (!Number.isInteger(value) || value < 1 || value > max) return { error: `Scores run from 1 to ${max}.` };
    rows.push({
      application_id: applicationId,
      criterion_id: criterionId,
      reviewer_id: user.id,
      score: value,
      updated_at: new Date().toISOString(),
    });
  }
  if (rows.length === 0) return {};

  // The first score locks the rubric so everyone is judged on the same criteria.
  await admin.from("rubric_criteria").update({ locked: true }).eq("opportunity_id", opportunityId).eq("locked", false);

  const { error } = await admin
    .from("application_scores")
    .upsert(rows, { onConflict: "application_id,reviewer_id,criterion_id" });
  if (error) return { error: error.message };

  revalidatePath(`/partner/dashboard/${opportunityId}`);
  return {};
}

/**
 * Step back from an application because of a conflict of interest. Their scores for
 * it are removed, they are never assigned it again, and in a split the place goes to
 * someone else.
 */
export async function recuseFromApplication(opportunityId: string, applicationId: string): Promise<{ error?: string }> {
  const { user } = await getServerUser();
  if (!user) return { error: "Please sign in again." };
  const admin = createAdminClient();

  const [{ data: opp }, { data: collab }, { data: app }] = await Promise.all([
    admin.from("opportunities").select("id, profile_id").eq("id", opportunityId).maybeSingle(),
    admin.from("opportunity_collaborators").select("role").eq("opportunity_id", opportunityId).eq("profile_id", user.id).maybeSingle(),
    admin.from("opportunity_applications").select("id").eq("id", applicationId).eq("opportunity_id", opportunityId).maybeSingle(),
  ]);
  if (!opp || !app) return { error: "Application not found." };
  if (opp.profile_id !== user.id && !collab) return { error: "You're not on this review team." };

  const { error } = await admin
    .from("application_recusals")
    .upsert(
      { application_id: applicationId, reviewer_id: user.id, opportunity_id: opportunityId, recused_by: user.id },
      { onConflict: "application_id,reviewer_id" },
    );
  if (error) return { error: error.message };

  await Promise.all([
    admin.from("application_scores").delete().eq("application_id", applicationId).eq("reviewer_id", user.id),
    admin.from("application_assignments").delete().eq("application_id", applicationId).eq("reviewer_id", user.id),
  ]);
  await rebalanceAssignments(admin, opportunityId, user.id);

  revalidatePath(`/partner/dashboard/${opportunityId}`);
  return {};
}
