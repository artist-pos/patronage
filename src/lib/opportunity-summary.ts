import type { Opportunity } from "@/types/database";
import { formatFunding } from "@/components/opportunities/OpportunityCard";

function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The facts of a listing as short, self-contained sentences. People skim it and
 * AI assistants can quote it without needing the rest of the page. Only states
 * what the listing records; nothing is inferred.
 */
export function summariseOpportunity(opp: Opportunity, todayIso: string): string[] {
  const where = opp.city ? `${opp.city}, ${opp.country}` : opp.country === "Global" ? "open internationally" : opp.country;
  const lines: string[] = [];

  lines.push(
    `${opp.title} is a ${opp.type.toLowerCase()} offered by ${opp.organiser}${where ? ` (${where})` : ""}.`
  );

  if (opp.deadline) {
    lines.push(
      opp.deadline < todayIso
        ? `Applications closed on ${longDate(opp.deadline)}.`
        : `Applications close on ${longDate(opp.deadline)}.`
    );
  } else {
    lines.push("It has no fixed deadline.");
  }
  if (opp.opens_at && opp.opens_at > todayIso) lines.push(`Applications open on ${longDate(opp.opens_at)}.`);

  const funding = opp.funding_range?.trim() || (opp.funding_amount != null ? formatFunding(opp.funding_amount) : null);
  if (funding) lines.push(`Funding or payment: ${funding}.`);

  if (opp.entry_fee === 0) lines.push("It is free to enter.");
  else if (opp.entry_fee != null) {
    const cur = opp.entry_fee_currency ?? "NZD";
    const local = opp.entry_fee_local ?? opp.entry_fee;
    lines.push(`The entry fee is ${local} ${cur}.`);
  }
  if (opp.travel_support) lines.push(`Travel support is offered${opp.travel_support_details ? `: ${opp.travel_support_details}` : ""}.`);

  return lines;
}
