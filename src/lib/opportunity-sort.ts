import type { Opportunity } from "@/types/database";
import { parseFundingText } from "./parse-funding";

export const OPP_SORTS = ["deadline", "funding", "newest"] as const;
export type OppSort = (typeof OPP_SORTS)[number];

export const OPP_SORT_LABELS: Record<OppSort, string> = {
  deadline: "Deadline: soonest",
  funding: "Funding: high to low",
  newest: "Newest listed",
};

/** Same fallback the cards themselves display with — a listing that only
 *  gives a text range ("$5,000 – $15,000") still sorts by its lower bound
 *  rather than dropping to the bottom as if it had no funding at all. */
function fundingValue(o: Pick<Opportunity, "funding_amount" | "funding_range">): number {
  return o.funding_amount ?? parseFundingText(o.funding_range) ?? -1;
}

/** Applied in-memory to an already-fetched page of results — sorting alone
 *  never needs to re-query, since the unfiltered browse list is fully
 *  cached and any filtered query is already small. */
export function sortOpportunities<T extends Opportunity>(opps: T[], sort: OppSort): T[] {
  const list = [...opps];
  if (sort === "funding") {
    return list.sort((a, b) => fundingValue(b) - fundingValue(a));
  }
  if (sort === "newest") {
    return list.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }
  // "deadline" — featured first, then soonest deadline, open-ended last.
  return list.sort((a, b) => {
    if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
    const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    return da - db;
  });
}
