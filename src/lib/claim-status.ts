export type ClaimStatus = "none" | "scheduled" | "sent" | "opened" | "claimed";

/** The fields a claim status is derived from — any Opportunity satisfies this. */
export interface ClaimSignals {
  profile_id: string | null;
  claim_invite_sent_at: string | null;
  claim_invite_scheduled_for: string | null;
  claim_link_opened_at: string | null;
}

/**
 * Where a listing sits in the claim funnel.
 *
 * "claimed" requires an opened claim link *and* an owner: claiming always runs
 * through /claim-listing/[token], which records the open before setting
 * profile_id. Owning alone means a partner created the listing (or an admin
 * assigned it), and holding a claim_token alone only means a link exists —
 * generating one for outreach must never read as claimed.
 */
export function getClaimStatus(o: ClaimSignals): ClaimStatus {
  if (o.profile_id && o.claim_link_opened_at) return "claimed";
  if (o.claim_link_opened_at) return "opened";
  if (o.claim_invite_sent_at) return "sent";
  if (o.claim_invite_scheduled_for) return "scheduled";
  return "none";
}
