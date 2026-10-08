import { createAdminClient } from "@/lib/supabase/admin";
import { readReviewConfig } from "@/lib/review-scoring";
import type { PipelineConfig } from "@/types/database";

type Admin = ReturnType<typeof createAdminClient>;

/** Editors on the opportunity, or the owner when there are none. */
export async function eligibleReviewers(admin: Admin, opportunityId: string, ownerId: string | null): Promise<string[]> {
  const { data } = await admin
    .from("opportunity_collaborators")
    .select("profile_id")
    .eq("opportunity_id", opportunityId)
    .eq("role", "editor");
  const ids = (data ?? []).map((r) => r.profile_id as string);
  if (ids.length > 0) return ids;
  return ownerId ? [ownerId] : [];
}

/**
 * Spread applications across reviewers in "split" mode. Existing work is kept:
 * a reviewer who has already scored an application stays assigned to it. The
 * remaining places go to whoever has the lightest load, so the split is even.
 */
export async function rebalanceAssignments(
  admin: Admin,
  opportunityId: string,
  actorId: string | null,
): Promise<{ assigned: number; error?: string }> {
  const { data: opp } = await admin
    .from("opportunities")
    .select("profile_id, pipeline_config")
    .eq("id", opportunityId)
    .single();
  if (!opp) return { assigned: 0, error: "Opportunity not found" };

  const config = readReviewConfig(opp.pipeline_config as PipelineConfig | null);
  if (config.assignment_mode !== "split") return { assigned: 0 };

  const reviewers = await eligibleReviewers(admin, opportunityId, opp.profile_id as string | null);
  if (reviewers.length === 0) return { assigned: 0, error: "Add a reviewer first." };

  const [{ data: apps }, { data: scored }, { data: recusalRows }] = await Promise.all([
    admin.from("opportunity_applications").select("id").eq("opportunity_id", opportunityId).order("created_at", { ascending: true }),
    admin
      .from("application_scores")
      .select("application_id, reviewer_id, opportunity_applications!inner(opportunity_id)")
      .eq("opportunity_applications.opportunity_id", opportunityId),
    admin.from("application_recusals").select("application_id, reviewer_id").eq("opportunity_id", opportunityId),
  ]);
  const recused = new Set((recusalRows ?? []).map((r) => `${r.application_id}:${r.reviewer_id}`));

  const perApp = Math.min(config.per_application, reviewers.length);
  const load = new Map<string, number>(reviewers.map((r) => [r, 0]));
  const plan = new Map<string, Set<string>>();

  for (const row of scored ?? []) {
    const appId = row.application_id as string;
    const reviewerId = row.reviewer_id as string;
    if (!load.has(reviewerId)) continue;
    const set = plan.get(appId) ?? new Set<string>();
    if (!set.has(reviewerId)) {
      set.add(reviewerId);
      load.set(reviewerId, (load.get(reviewerId) ?? 0) + 1);
    }
    plan.set(appId, set);
  }

  for (const app of apps ?? []) {
    const appId = app.id as string;
    const set = plan.get(appId) ?? new Set<string>();
    while (set.size < perApp) {
      const next = [...load.entries()]
        .filter(([id]) => !set.has(id) && !recused.has(`${appId}:${id}`))
        .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0];
      if (!next) break;
      set.add(next[0]);
      load.set(next[0], next[1] + 1);
    }
    plan.set(appId, set);
  }

  const rows = [...plan.entries()].flatMap(([appId, set]) =>
    [...set].map((reviewerId) => ({
      application_id: appId,
      reviewer_id: reviewerId,
      opportunity_id: opportunityId,
      assigned_by: actorId,
    })),
  );

  const { error: deleteError } = await admin.from("application_assignments").delete().eq("opportunity_id", opportunityId);
  if (deleteError) return { assigned: 0, error: deleteError.message };
  if (rows.length > 0) {
    const { error: insertError } = await admin.from("application_assignments").insert(rows);
    if (insertError) return { assigned: 0, error: insertError.message };
  }
  return { assigned: rows.length };
}

/** Called when a new application arrives: give it its reviewers if the call is in "split" mode. */
export async function assignNewApplication(admin: Admin, opportunityId: string, applicationId: string): Promise<void> {
  const { data: opp } = await admin
    .from("opportunities")
    .select("profile_id, pipeline_config")
    .eq("id", opportunityId)
    .single();
  if (!opp) return;
  const config = readReviewConfig(opp.pipeline_config as PipelineConfig | null);
  if (config.assignment_mode !== "split") return;

  const reviewers = await eligibleReviewers(admin, opportunityId, opp.profile_id as string | null);
  if (reviewers.length === 0) return;

  const { data: existing } = await admin
    .from("application_assignments")
    .select("reviewer_id")
    .eq("opportunity_id", opportunityId);
  const load = new Map<string, number>(reviewers.map((r) => [r, 0]));
  for (const row of existing ?? []) {
    const id = row.reviewer_id as string;
    if (load.has(id)) load.set(id, (load.get(id) ?? 0) + 1);
  }

  const picks = [...load.entries()]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .slice(0, Math.min(config.per_application, reviewers.length))
    .map(([id]) => ({ application_id: applicationId, reviewer_id: id, opportunity_id: opportunityId, assigned_by: null }));
  if (picks.length > 0) await admin.from("application_assignments").insert(picks);
}
