/**
 * Reasons an admin can give when declining a partner listing. Shared by the
 * admin reject form (labels) and the organiser email (statements), so the two
 * can't drift. Safe to import from client components.
 *
 * `terms` reasons point at section 10 of the Terms of Service. A reason that is
 * not `fixable` means editing the listing won't change the outcome, so the
 * email doesn't invite them to resubmit it.
 */
export interface RejectionReason {
  key: string;
  /** Short label for the admin checkbox. */
  label: string;
  /** What the organiser reads. */
  statement: string;
  terms: boolean;
  fixable: boolean;
}

export const REJECTION_REASONS: RejectionReason[] = [
  {
    key: "self_promotion",
    label: "Promotes the organiser's own site or service",
    statement:
      "The listing mainly promotes your own website, app, marketplace or service, rather than offering artists a grant, residency, commission, open call, prize or exhibition.",
    terms: true,
    fixable: false,
  },
  {
    key: "competing_platform",
    label: "Directs artists to a competing platform",
    statement:
      "The listing directs artists to list, sell or build a profile on a platform that competes with Patronage.",
    terms: true,
    fixable: false,
  },
  {
    key: "platform_requirement",
    label: "Requires sign-up, minting, wallet or platform fees",
    statement:
      "Taking part requires artists to register, mint, buy, list work, connect a wallet or pay platform or blockchain fees.",
    terms: true,
    fixable: false,
  },
  {
    key: "platform_only_value",
    label: "Main benefit only usable on the organiser's platform",
    statement:
      "The main benefit on offer (such as credits or badges) can only be used on your own platform.",
    terms: true,
    fixable: false,
  },
  {
    key: "misleading",
    label: "Fees, prizes, eligibility or dates unclear or inaccurate",
    statement:
      "Some details, such as fees, prizes, eligibility or dates, are unclear, inaccurate or incomplete.",
    terms: true,
    fixable: true,
  },
  {
    key: "incomplete",
    label: "Missing key information",
    statement: "The listing is missing information artists need in order to apply.",
    terms: false,
    fixable: true,
  },
  {
    key: "not_arts",
    label: "Not an arts opportunity",
    statement: "The listing isn't an opportunity for artists or the arts sector.",
    terms: false,
    fixable: false,
  },
  {
    key: "duplicate",
    label: "Duplicate of an existing listing",
    statement: "This opportunity is already listed on Patronage.",
    terms: false,
    fixable: false,
  },
];

const BY_KEY = new Map(REJECTION_REASONS.map((r) => [r.key, r]));

/** Drops unknown keys, so a tampered request can't inject its own wording. */
export function resolveRejectionReasons(keys: readonly string[] | undefined): RejectionReason[] {
  const seen = new Set<string>();
  const out: RejectionReason[] = [];
  for (const key of keys ?? []) {
    const r = BY_KEY.get(key);
    if (r && !seen.has(key)) {
      seen.add(key);
      out.push(r);
    }
  }
  return out;
}

/** One line for the in-app notification, the same wording as the email. */
export function summariseRejection(reasons: RejectionReason[], message?: string | null): string {
  const parts = reasons.map((r) => r.statement);
  const note = message?.trim();
  if (note) parts.push(note);
  return parts.join(" ");
}
