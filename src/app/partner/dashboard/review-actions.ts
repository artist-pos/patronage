"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { sendNudgeEmail } from "@/lib/email";
import {
  readReviewConfig,
  summariseScores,
  type AssignmentMode,
  type ReviewConfig,
  type ScoreRow,
} from "@/lib/review-scoring";
import { eligibleReviewers, rebalanceAssignments } from "@/lib/review-assignment";
import type { PipelineConfig } from "@/types/database";

type Level = "owner" | "editor" | "viewer";

/** The caller's access to an opportunity, or null if they have none. */
async function teamAccess(opportunityId: string) {
  const { supabase, user } = await getServerUser();
  if (!user) return null;
  // Membership is checked with the admin client: a guest reviewer cannot read
  // an unpublished opportunity row through RLS, but is still on the team.
  const admin = createAdminClient();
  const [{ data: profile }, { data: opp }] = await Promise.all([
    admin.from("profiles").select("role").eq("id", user.id).single(),
    admin.from("opportunities").select("id, title, profile_id, pipeline_config").eq("id", opportunityId).single(),
  ]);
  if (!opp) return null;
  const isAdmin = profile?.role === "admin" || profile?.role === "owner";
  let level: Level | null = isAdmin || opp.profile_id === user.id ? "owner" : null;
  if (!level) {
    const { data: collab } = await admin
      .from("opportunity_collaborators")
      .select("role")
      .eq("opportunity_id", opportunityId)
      .eq("profile_id", user.id)
      .maybeSingle();
    if (collab) level = collab.role === "editor" ? "editor" : "viewer";
  }
  if (!level) return null;
  return { supabase, user, opp, level };
}

export interface ReviewerSummaryDTO {
  reviewerId: string;
  name: string;
  pct: number;
  complete: boolean;
}

export interface ApplicationScoreDTO {
  /** Names of reviewers who stepped back from this application. */
  recusedBy: string[];
  /** Null until the caller is allowed to see it. */
  avg: number | null;
  spread: number | null;
  reviewersComplete: number;
  reviewersAssigned: number;
  reviewers: ReviewerSummaryDTO[];
  assignedTo: string[];
}

export interface ReviewOverview {
  config: ReviewConfig;
  scores: Record<string, ApplicationScoreDTO>;
  progress: Record<string, { assigned: number; complete: number }>;
  team: Array<{ id: string; name: string; role: "owner" | "editor" | "viewer" }>;
  hasRubric: boolean;
}

/**
 * Everything the board needs to show scores: averages, spread, who has finished,
 * and each reviewer's progress. Editors only see other people's scores for an
 * application once they have finished scoring it themselves, so one reviewer
 * doesn't anchor another.
 */
export async function getReviewOverview(opportunityId: string): Promise<ReviewOverview | null> {
  const access = await teamAccess(opportunityId);
  if (!access || access.level === "viewer") return null;
  const { user, opp, level } = access;
  const admin = createAdminClient();

  const [{ data: criteria }, { data: apps }, { data: scoreRows }, { data: assignRows }, { data: collabs }, { data: recusalRows }] = await Promise.all([
    admin.from("rubric_criteria").select("id, weight, scale_max").eq("opportunity_id", opportunityId),
    admin.from("opportunity_applications").select("id").eq("opportunity_id", opportunityId),
    admin
      .from("application_scores")
      .select("application_id, criterion_id, reviewer_id, score, opportunity_applications!inner(opportunity_id)")
      .eq("opportunity_applications.opportunity_id", opportunityId),
    admin.from("application_assignments").select("application_id, reviewer_id").eq("opportunity_id", opportunityId),
    admin.from("opportunity_collaborators").select("profile_id, role").eq("opportunity_id", opportunityId),
    admin.from("application_recusals").select("application_id, reviewer_id").eq("opportunity_id", opportunityId),
  ]);
  const recusedByApp = new Map<string, string[]>();
  for (const r of recusalRows ?? []) {
    const list = recusedByApp.get(r.application_id as string) ?? [];
    list.push(r.reviewer_id as string);
    recusedByApp.set(r.application_id as string, list);
  }

  const config = readReviewConfig(opp.pipeline_config as PipelineConfig | null);
  const crit = (criteria ?? []) as Array<{ id: string; weight: number; scale_max: number }>;
  const appIds = (apps ?? []).map((a) => a.id as string);

  const assigned = new Map<string, Set<string>>();
  for (const r of assignRows ?? []) {
    const set = assigned.get(r.application_id as string) ?? new Set<string>();
    set.add(r.reviewer_id as string);
    assigned.set(r.application_id as string, set);
  }

  const summary = summariseScores(crit, (scoreRows ?? []) as unknown as ScoreRow[], assigned, appIds);

  const people = new Set<string>([
    opp.profile_id as string,
    ...(collabs ?? []).map((c) => c.profile_id as string),
    ...(recusalRows ?? []).map((r) => r.reviewer_id as string),
  ]);
  const { data: profiles } = await admin.from("profiles").select("id, full_name, username").in("id", [...people]);
  const names = new Map((profiles ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? (p.username as string)]));

  const scores: Record<string, ApplicationScoreDTO> = {};
  for (const [appId, s] of summary) {
    const mine = s.byReviewer.find((r) => r.reviewer_id === user.id);
    const mayCompare = level === "owner" || !!mine?.complete;
    scores[appId] = {
      avg: mayCompare ? s.avg : null,
      spread: mayCompare ? s.spread : null,
      reviewersComplete: s.reviewersComplete,
      reviewersAssigned: s.reviewersAssigned,
      reviewers: mayCompare
        ? s.byReviewer.map((r) => ({ reviewerId: r.reviewer_id, name: names.get(r.reviewer_id) ?? "Reviewer", pct: r.pct, complete: r.complete }))
        : mine
          ? [{ reviewerId: mine.reviewer_id, name: names.get(mine.reviewer_id) ?? "You", pct: mine.pct, complete: mine.complete }]
          : [],
      assignedTo: level === "owner" ? [...(assigned.get(appId) ?? [])] : [],
      recusedBy: level === "owner" ? (recusedByApp.get(appId) ?? []).map((id) => names.get(id) ?? "A reviewer") : [],
    };
  }

  const progress: Record<string, { assigned: number; complete: number }> = {};
  const reviewerIds = (collabs ?? []).filter((c) => c.role === "editor").map((c) => c.profile_id as string);
  if (reviewerIds.length === 0) reviewerIds.push(opp.profile_id as string);
  for (const reviewerId of reviewerIds) {
    const mine = appIds
      .filter((id) => !(recusedByApp.get(id) ?? []).includes(reviewerId))
      .filter((id) => config.assignment_mode === "all" || assigned.get(id)?.has(reviewerId));
    const complete = mine.filter((id) => summary.get(id)?.byReviewer.some((r) => r.reviewer_id === reviewerId && r.complete)).length;
    progress[reviewerId] = { assigned: mine.length, complete };
  }

  const team = [
    { id: opp.profile_id as string, name: names.get(opp.profile_id as string) ?? "Owner", role: "owner" as const },
    ...(collabs ?? []).map((c) => ({ id: c.profile_id as string, name: names.get(c.profile_id as string) ?? "Reviewer", role: c.role as "editor" | "viewer" })),
  ];

  return { config, scores, progress, team, hasRubric: crit.length > 0 };
}

/** Choose how applications are shared out, then (for "split") share them out. */
export async function setReviewAssignment(
  opportunityId: string,
  mode: AssignmentMode,
  perApplication: number,
): Promise<{ error?: string; assigned?: number }> {
  const access = await teamAccess(opportunityId);
  if (!access || access.level !== "owner") return { error: "Not authorised" };

  const existing = (access.opp.pipeline_config ?? {}) as PipelineConfig;
  const review: ReviewConfig = {
    ...readReviewConfig(existing),
    assignment_mode: mode === "split" || mode === "manual" ? mode : "all",
    per_application: Math.max(1, Math.min(10, Math.round(perApplication) || 2)),
  };
  const { error } = await access.supabase
    .from("opportunities")
    .update({ pipeline_config: { ...existing, review } })
    .eq("id", opportunityId);
  if (error) return { error: error.message };

  const admin = createAdminClient();
  let assigned = 0;
  if (review.assignment_mode === "split") {
    const result = await rebalanceAssignments(admin, opportunityId, access.user.id);
    if (result.error) return { error: result.error };
    assigned = result.assigned;
  } else if (review.assignment_mode === "all") {
    await admin.from("application_assignments").delete().eq("opportunity_id", opportunityId);
  }

  revalidatePath(`/partner/dashboard/${opportunityId}`);
  return { assigned };
}

/** Hide applicant identities from reviewers. */
export async function setBlindReview(opportunityId: string, blind: boolean): Promise<{ error?: string }> {
  const access = await teamAccess(opportunityId);
  if (!access || access.level !== "owner") return { error: "Not authorised" };
  const existing = (access.opp.pipeline_config ?? {}) as PipelineConfig;
  const review: ReviewConfig = { ...readReviewConfig(existing), blind };
  const { error } = await access.supabase
    .from("opportunities")
    .update({ pipeline_config: { ...existing, review } })
    .eq("id", opportunityId);
  if (error) return { error: error.message };
  revalidatePath(`/partner/dashboard/${opportunityId}`);
  return {};
}

/** Manually choose who reviews one application. */
export async function setApplicationReviewers(
  applicationId: string,
  reviewerIds: string[],
): Promise<{ error?: string }> {
  const { user } = await getServerUser();
  if (!user) return { error: "Not authenticated" };
  const { data: app } = await createAdminClient().from("opportunity_applications").select("id, opportunity_id").eq("id", applicationId).single();
  if (!app) return { error: "Application not found" };
  const access = await teamAccess(app.opportunity_id as string);
  if (!access || access.level !== "owner") return { error: "Not authorised" };

  const admin = createAdminClient();
  const allowed = new Set(await eligibleReviewers(admin, app.opportunity_id as string, access.opp.profile_id as string | null));
  const chosen = reviewerIds.filter((id) => allowed.has(id));

  await admin.from("application_assignments").delete().eq("application_id", applicationId);
  if (chosen.length > 0) {
    const { error } = await admin.from("application_assignments").insert(
      chosen.map((reviewer_id) => ({
        application_id: applicationId,
        reviewer_id,
        opportunity_id: app.opportunity_id as string,
        assigned_by: user.id,
      })),
    );
    if (error) return { error: error.message };
  }
  revalidatePath(`/partner/dashboard/${app.opportunity_id}`);
  return {};
}

/** Remind a reviewer who still has applications to score. */
export async function remindReviewer(opportunityId: string, reviewerId: string): Promise<{ error?: string }> {
  const access = await teamAccess(opportunityId);
  if (!access || access.level !== "owner") return { error: "Not authorised" };
  const admin = createAdminClient();
  const { data: authData } = await admin.auth.admin.getUserById(reviewerId);
  const email = authData?.user?.email;
  if (!email) return { error: "No email address for this reviewer." };
  try {
    await sendNudgeEmail({ reviewerEmail: email, opportunityTitle: access.opp.title as string, opportunityId });
  } catch {
    return { error: "The reminder could not be sent." };
  }
  return {};
}

// ── Notes between reviewers ───────────────────────────────────────────────────

export interface NoteDTO {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  mine: boolean;
}

export async function getNotes(applicationId: string): Promise<NoteDTO[]> {
  const { user } = await getServerUser();
  if (!user) return [];
  const { data: app } = await createAdminClient().from("opportunity_applications").select("opportunity_id").eq("id", applicationId).single();
  if (!app) return [];
  const access = await teamAccess(app.opportunity_id as string);
  if (!access) return [];

  const admin = createAdminClient();
  const { data: notes } = await admin
    .from("application_notes")
    .select("id, author_id, body, created_at")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: true });
  const authorIds = [...new Set((notes ?? []).map((n) => n.author_id as string))];
  const { data: profiles } = authorIds.length
    ? await admin.from("profiles").select("id, full_name, username").in("id", authorIds)
    : { data: [] };
  const names = new Map((profiles ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? (p.username as string)]));
  return (notes ?? []).map((n) => ({
    id: n.id as string,
    authorId: n.author_id as string,
    authorName: names.get(n.author_id as string) ?? "Reviewer",
    body: n.body as string,
    createdAt: n.created_at as string,
    mine: n.author_id === user.id,
  }));
}

export async function addNote(applicationId: string, body: string): Promise<{ error?: string }> {
  const text = body.trim();
  if (!text) return { error: "Write a note first." };
  if (text.length > 2000) return { error: "Notes are limited to 2000 characters." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { data: app } = await createAdminClient().from("opportunity_applications").select("opportunity_id").eq("id", applicationId).single();
  if (!app) return { error: "Application not found" };
  const access = await teamAccess(app.opportunity_id as string);
  if (!access || access.level === "viewer") return { error: "Not authorised" };

  const admin = createAdminClient();
  const { error } = await admin.from("application_notes").insert({
    application_id: applicationId,
    opportunity_id: app.opportunity_id as string,
    author_id: user.id,
    body: text,
  });
  if (error) return { error: error.message };
  return {};
}

export interface ScoreMatrix {
  criteria: Array<{ id: string; label: string; scaleMax: number; weight: number }>;
  reviewers: Array<{ id: string; name: string }>;
  /** reviewer id -> criterion id -> score */
  scores: Record<string, Record<string, number>>;
}

/**
 * Every reviewer's score for every criterion on one application, so a panel can see
 * exactly where they disagree. The owner sees it any time; an editor only after they
 * have scored the application themselves.
 */
export async function getScoreMatrix(applicationId: string): Promise<ScoreMatrix | null> {
  const { user } = await getServerUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: app } = await admin.from("opportunity_applications").select("id, opportunity_id").eq("id", applicationId).single();
  if (!app) return null;
  const access = await teamAccess(app.opportunity_id as string);
  if (!access || access.level === "viewer") return null;

  const [{ data: criteria }, { data: rows }] = await Promise.all([
    admin.from("rubric_criteria").select("id, label, scale_max, weight").eq("opportunity_id", app.opportunity_id as string).order("position"),
    admin.from("application_scores").select("reviewer_id, criterion_id, score").eq("application_id", applicationId),
  ]);
  const crit = (criteria ?? []) as Array<{ id: string; label: string; scale_max: number; weight: number }>;

  const scores: Record<string, Record<string, number>> = {};
  for (const r of rows ?? []) (scores[r.reviewer_id as string] ??= {})[r.criterion_id as string] = r.score as number;

  if (access.level === "editor") {
    const mine = scores[user.id];
    if (!mine || !crit.every((c) => mine[c.id])) return null;
  }

  const ids = Object.keys(scores);
  const { data: profiles } = ids.length
    ? await admin.from("profiles").select("id, full_name, username").in("id", ids)
    : { data: [] };
  const names = new Map((profiles ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? (p.username as string)]));

  return {
    criteria: crit.map((c) => ({ id: c.id, label: c.label, scaleMax: c.scale_max, weight: c.weight })),
    reviewers: ids.map((id) => ({ id, name: names.get(id) ?? "Reviewer" })),
    scores,
  };
}
