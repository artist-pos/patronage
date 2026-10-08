import type { PipelineConfig } from "@/types/database";

export interface ScoringCriterion {
  id: string;
  weight: number;
  scale_max: number;
}

export interface ScoreRow {
  application_id: string;
  criterion_id: string;
  reviewer_id: string;
  score: number;
}

export interface ReviewerScore {
  reviewer_id: string;
  /** Weighted score as a percentage of the maximum, 0-100. */
  pct: number;
  /** True once this reviewer has scored every criterion. */
  complete: boolean;
}

export interface ApplicationScoreSummary {
  /** Mean of complete reviewers' percentages (falls back to partial ones). */
  avg: number | null;
  /** Highest minus lowest complete reviewer percentage, when two or more. */
  spread: number | null;
  reviewersComplete: number;
  reviewersAssigned: number;
  byReviewer: ReviewerScore[];
}

export type AssignmentMode = "all" | "split" | "manual";

export interface ReviewConfig {
  assignment_mode: AssignmentMode;
  /** Reviewers per application when the mode is "split". */
  per_application: number;
  /** Hide applicant names, locations, profiles and CVs from reviewers. */
  blind: boolean;
}

export const DEFAULT_REVIEW_CONFIG: ReviewConfig = { assignment_mode: "all", per_application: 2, blind: false };

/** Review settings live in pipeline_config.review. */
export function readReviewConfig(pipelineConfig: PipelineConfig | null | undefined): ReviewConfig {
  const raw = (pipelineConfig as { review?: Partial<ReviewConfig> } | null | undefined)?.review;
  const mode = raw?.assignment_mode;
  return {
    assignment_mode: mode === "split" || mode === "manual" ? mode : "all",
    per_application: Math.max(1, Math.min(10, Math.round(raw?.per_application ?? DEFAULT_REVIEW_CONFIG.per_application))),
    blind: raw?.blind === true,
  };
}

function weightedPct(criteria: ScoringCriterion[], byCriterion: Map<string, number>): number | null {
  let sum = 0;
  let weight = 0;
  for (const c of criteria) {
    const s = byCriterion.get(c.id);
    if (s === undefined) continue;
    sum += (Math.min(s, c.scale_max) / c.scale_max) * c.weight;
    weight += c.weight;
  }
  return weight > 0 ? (sum / weight) * 100 : null;
}

/**
 * Aggregate raw scores into one summary per application.
 * `assigned` maps application id to the reviewers expected to score it.
 */
export function summariseScores(
  criteria: ScoringCriterion[],
  scores: ScoreRow[],
  assigned: Map<string, Set<string>>,
  applicationIds: string[],
): Map<string, ApplicationScoreSummary> {
  const byApp = new Map<string, Map<string, Map<string, number>>>();
  for (const s of scores) {
    let reviewers = byApp.get(s.application_id);
    if (!reviewers) byApp.set(s.application_id, (reviewers = new Map()));
    let criteriaScores = reviewers.get(s.reviewer_id);
    if (!criteriaScores) reviewers.set(s.reviewer_id, (criteriaScores = new Map()));
    criteriaScores.set(s.criterion_id, s.score);
  }

  const out = new Map<string, ApplicationScoreSummary>();
  for (const appId of applicationIds) {
    const reviewers = byApp.get(appId) ?? new Map<string, Map<string, number>>();
    const byReviewer: ReviewerScore[] = [];
    for (const [reviewerId, byCriterion] of reviewers) {
      const pct = weightedPct(criteria, byCriterion);
      if (pct === null) continue;
      byReviewer.push({ reviewer_id: reviewerId, pct, complete: criteria.every((c) => byCriterion.has(c.id)) });
    }
    const complete = byReviewer.filter((r) => r.complete);
    const basis = complete.length > 0 ? complete : byReviewer;
    const avg = basis.length > 0 ? basis.reduce((t, r) => t + r.pct, 0) / basis.length : null;
    const spread = complete.length > 1
      ? Math.max(...complete.map((r) => r.pct)) - Math.min(...complete.map((r) => r.pct))
      : null;
    out.set(appId, {
      avg,
      spread,
      reviewersComplete: complete.length,
      reviewersAssigned: assigned.get(appId)?.size ?? 0,
      byReviewer,
    });
  }
  return out;
}
