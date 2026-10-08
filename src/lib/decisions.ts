/**
 * Decisions are private; results are public.
 *
 * `application_decisions` holds the organiser's working decision. The artist's own
 * row, `opportunity_applications.status`, holds only what they have been told, and
 * changes when results are published. Artists cannot read the decisions table.
 */

export interface Decision {
  status: string;
  rejection_reason: string | null;
  selection_message: string | null;
}

/** The stages after selection. Once told "selected", someone can only move forward through these. */
export const DELIVERY_STAGES = ["selected", "approved_pending_assets", "production_ready"] as const;

/**
 * Published results are final. Returns a plain-English reason if moving to `next`
 * would contradict what the artist has already been told, or null if it is fine.
 * `published` is the artist-facing status, not the working decision.
 */
export function transitionError(published: string | null | undefined, next: string): string | null {
  if (!published || published === "pending") return null;

  if (published === "rejected") {
    return "This result has been published, so it can't be changed.";
  }
  if (published === "shortlisted") {
    return next === "pending" ? "They've been told they're shortlisted, so they can't go back to New." : null;
  }

  const stages: readonly string[] = DELIVERY_STAGES;
  if (stages.includes(published)) {
    if (!stages.includes(next)) {
      return "They've been told they're selected, so they can only move forward through the selected stages.";
    }
    if (stages.indexOf(next) < stages.indexOf(published)) {
      return "A published selection can only move forward, not back.";
    }
  }
  return null;
}
