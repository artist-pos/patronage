const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

/**
 * Claim invite copy. Shaped on the hand-sent invites that got replies and claims
 * (Font, Waiheke Art Gallery, Grace Butler): the subject names the listing, the
 * opening is one plain line about what was added, the claim link comes early,
 * and the pitch for the application tool names how they take applications today
 * instead of describing it in the abstract.
 */

export interface TemplateVars {
  recipientName: string;
  organiserName: string;
  opportunityTitle: string;
  claimUrl: string;
  listingUrl?: string;
  /** A true, specific line about how the listing is doing, e.g. "4 creatives have clicked through to apply." */
  engagement?: string;
  /** How they take applications now (opportunities.claim_current_tool): Email, Google Form, Jotform… */
  currentTool?: string | null;
}

/** "team" in the contact name field means a shared inbox: greet the organisation's team. */
export function greetingName(recipientName: string, organiserName: string): string {
  const name = recipientName.trim();
  if (!name || name.toLowerCase() === "team") return organiserName ? `${organiserName} team` : "there";
  return name;
}

/** Organisations already on Patronage, named in the pitch. Keep it to ones that are. */
const ALREADY_ON = "Gus Fisher Gallery, Waiheke Art Gallery, Font Public Art Trust and Playmarket";

/** "I noticed …" for the tool they use now, or null when we don't know it. */
function noticedLine(tool: string | null | undefined): string | null {
  const t = (tool ?? "").trim().toLowerCase();
  if (!t || t === "unknown") return null;
  if (t.includes("email")) return "I noticed applications currently come in by email.";
  if (t.includes("google")) return "I noticed applications currently come in through a Google Form.";
  if (t.includes("jotform")) return "I noticed applications currently come in through Jotform.";
  if (t.includes("website")) return "I noticed applications currently come in through a form on your website.";
  if (t.includes("submittable")) return "I noticed you take applications through Submittable.";
  if (t.includes("smartygrants")) return "I noticed you take applications through SmartyGrants.";
  if (t.includes("post") || t.includes("phone")) return "I noticed applications currently come in by post.";
  return null;
}

function toolPitch(tool: string | null | undefined): string {
  const noticed = noticedLine(tool);
  const t = (tool ?? "").toLowerCase();
  const paid = t.includes("submittable") || t.includes("smartygrants");

  const what = paid
    ? "Patronage has an application tool that does the same job at no cost: artists apply with their Patronage profile, so their portfolio, CV and exhibition history arrive attached, and your panel reviews, shortlists and scores in one dashboard."
    : "Patronage has a free application tool built for this: artists apply with their Patronage profile, so their portfolio, CV and exhibition history arrive attached, and you review, shortlist and score everything in one dashboard rather than across inboxes and spreadsheets.";

  return `${noticed ? `${noticed} ` : ""}${what} It saves artists rebuilding their CV for every round, too.

A few organisations already use Patronage, including ${ALREADY_ON}. Happy to set it up for your next round if it would help.`;
}

export function buildClaimOnlyBody(vars: TemplateVars): string {
  return `Kia ora ${greetingName(vars.recipientName, vars.organiserName)},

Just letting you know I've added ${vars.opportunityTitle} to Patronage, a platform connecting creatives in Aotearoa with opportunities.${vars.engagement ? ` ${vars.engagement}` : ""}

You can claim the listing here if you'd like to manage it directly. You'll be able to edit the details, update the deadline and see how many creatives are viewing it. The listing stays live either way.

${vars.claimUrl}

${toolPitch(vars.currentTool)}

Ngā mihi,
Blake Aitken
Patronage · patronage.nz`;
}

export function buildClaimPipelineBody(vars: TemplateVars): string {
  return `Kia ora ${greetingName(vars.recipientName, vars.organiserName)},

Just letting you know I've added ${vars.opportunityTitle} to Patronage, a platform connecting creatives in Aotearoa with opportunities.${vars.engagement ? ` ${vars.engagement}` : ""}

You can claim the listing here if you'd like to manage it directly. The listing stays live either way.

${vars.claimUrl}

${toolPitch(vars.currentTool)} If a quick call is easier, just reply with a time that suits.

Ngā mihi,
Blake Aitken
Patronage · patronage.nz`;
}

/** Name the listing: every hand-sent invite that got a reply did. */
export function buildTemplateSubject(
  _template: "claim_only" | "claim_pipeline",
  opportunityTitle: string
): string {
  const title = opportunityTitle.trim();
  if (!title) return "Your opportunity is live on Patronage";
  const short = title.length > 60 ? `${title.slice(0, 57).trimEnd()}…` : title;
  return `${short} is now on Patronage`;
}

export function buildClaimUrl(token: string): string {
  return `${SITE_URL}/claim-listing/${token}`;
}
