/**
 * Works out where an open call is in its life and what the organiser should do next,
 * in plain words. Used by the opportunity page and the dashboard so both always agree.
 */

export const LIFE_STAGES = ["Collect applications", "Review", "Tell artists", "Finished"] as const;

export type NextTarget = "review" | "results" | "share" | "close" | "team" | "archive" | "edit" | "reopen";

export interface NextStepInput {
  /** opportunities.status */
  status: string;
  archived: boolean;
  /** Applications have been closed, by the organiser or by the deadline passing. */
  closed: boolean;
  daysLeft: number | null;
  total: number;
  /** Still at New: no decision yet. */
  undecided: number;
  /** Decided, but the artist has not been told. */
  unpublished: number;
  /** Other people helping to review. */
  reviewers: number;
}

export interface NextStep {
  /** Index into LIFE_STAGES. */
  stage: 0 | 1 | 2 | 3;
  headline: string;
  detail: string;
  action?: { label: string; target: NextTarget };
  /** A quieter second choice. */
  alternative?: { label: string; target: NextTarget };
  /** Higher means more urgent on the dashboard. */
  priority: number;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function nextStep(i: NextStepInput): NextStep {
  if (i.archived) {
    return { stage: 3, priority: 0, headline: "This call is finished.", detail: "Everything is kept. You can restore it from Settings if you need to." };
  }

  if (i.status === "draft" || i.status === "pending") {
    return i.status === "draft"
      ? { stage: 0, priority: 60, headline: "Finish setting up your call.", detail: "It isn't public yet. Complete the last steps and send it to us to check.", action: { label: "Continue setting up", target: "edit" } }
      : { stage: 0, priority: 10, headline: "We're checking your call.", detail: "We usually reply within two working days, and we'll email you when it's live." };
  }

  if (!i.closed) {
    const closing = i.daysLeft !== null && i.daysLeft > 0 ? ` It closes in ${plural(i.daysLeft, "day", "days")}.` : "";
    if (i.total === 0) {
      return {
        stage: 0, priority: 20,
        headline: "Your call is open. Now tell people about it.",
        detail: `No applications yet.${closing} Share the link with artists, schools and your own mailing list.`,
        action: { label: "Copy the link to share", target: "share" },
      };
    }
    if (i.undecided > 0) {
      return {
        stage: 0, priority: 70,
        headline: `${plural(i.undecided, "new application", "new applications")} to look at.`,
        detail: `You can start now. Nothing is sent to artists until you choose to send it.${closing}`,
        action: { label: "Start reviewing", target: "review" },
        alternative: i.reviewers === 0 ? { label: "Invite someone to help", target: "team" } : { label: "Close applications", target: "close" },
      };
    }
    return {
      stage: 0, priority: 30,
      headline: "You've looked at everything so far.",
      detail: `${plural(i.total, "application", "applications")} received.${closing}`,
      action: { label: "Close applications", target: "close" },
    };
  }

  // Applications are closed.
  if (i.total === 0) {
    return { stage: 3, priority: 15, headline: "Applications closed with none received.", detail: "You can reopen the call, or archive it to tidy it away.", action: { label: "Reopen the call", target: "reopen" }, alternative: { label: "Archive it", target: "archive" } };
  }
  if (i.undecided > 0) {
    return {
      stage: 1, priority: 90,
      headline: `Applications have closed. ${plural(i.undecided, "application is", "applications are")} still waiting for a decision.`,
      detail: "Go through each one, then choose Shortlisted, Selected or Not selected. Artists aren't told yet.",
      action: { label: "Continue reviewing", target: "review" },
    };
  }
  if (i.unpublished > 0) {
    return {
      stage: 2, priority: 95,
      headline: `You've decided on everyone. Now tell the artists.`,
      detail: `${plural(i.unpublished, "artist hasn't", "artists haven't")} heard yet. You'll see exactly who gets which email before anything is sent.`,
      action: { label: "Check and send results", target: "results" },
    };
  }
  return {
    stage: 3, priority: 25,
    headline: "Everyone has been told. Well done.",
    detail: "When you've finished with this call, archive it. Applications and the public page are kept.",
    action: { label: "Archive this call", target: "archive" },
  };
}
