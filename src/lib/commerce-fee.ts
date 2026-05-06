import { grossUpForStripe } from "@/lib/commerce-pricing";

/**
 * Money math for every Patronage commerce surface. All amounts are in
 * **minor units** (cents) — Stripe's API uses cents and we keep the same
 * convention end-to-end to avoid floating-point drift.
 *
 * Fee policy lives in docs/commerce-fee-policy.md. Update both when changing.
 *
 * Two fee shapes exist:
 *   - marketplace: a third-party seller exists; buyer pays sticker + uplift,
 *     seller receives sticker, Patronage retains commission, optional artist
 *     royalty earmarked separately (resales).
 *   - patronage_direct: Patronage IS the seller (entry fees, featured
 *     listings); buyer pays the listed amount, Patronage retains all of it.
 */

export const ROYALTY_HOLD_DAYS = 90;

export type CommerceSurface =
  | "resale"
  | "primary_sale"
  | "negotiated_sale"
  | "support_one_off"
  | "support_recurring"
  | "pipeline_entry_fee"
  | "featured_listing"
  | "partner_submission";

type FeeModel =
  | {
      kind: "marketplace";
      commissionRate: number;
      royaltyRate?: number;
    }
  | {
      kind: "patronage_direct";
    };

const FEE_SCHEDULE: Record<CommerceSurface, FeeModel> = {
  resale:             { kind: "marketplace", commissionRate: 0.10, royaltyRate: 0.05 },
  primary_sale:       { kind: "marketplace", commissionRate: 0.10 },
  negotiated_sale:    { kind: "marketplace", commissionRate: 0.10 },
  support_one_off:    { kind: "marketplace", commissionRate: 0.05 },
  support_recurring:  { kind: "marketplace", commissionRate: 0.05 },
  pipeline_entry_fee: { kind: "patronage_direct" },
  featured_listing:   { kind: "patronage_direct" },
  partner_submission: { kind: "patronage_direct" },
};

export interface ResolvedFees {
  /** What the seller listed at (marketplace) or what Patronage charges
   *  (patronage_direct). The headline figure shown to the buyer. */
  subjectPriceCents: number;
  /** What Patronage retains. */
  patronageRevenueCents: number;
  /** Earmarked for a third party (artist royalty on resale, primary artist
   *  payout on primary sale, recipient artist on support tiers). 0 for
   *  patronage_direct surfaces. */
  thirdPartyOwedCents: number;
  /** Stripe processing fee passed through to the buyer (2.9% + $0.30 NZ).
   *  NZ Commerce Commission requires surcharges to reflect actual cost. */
  stripeFeeCents: number;
  /** What Stripe charges the buyer's card — includes commission, royalty
   *  (where applicable), and the Stripe processing-fee passthrough. */
  buyerPaidTotalCents: number;
  /** What the seller receives at payout time. 0 for patronage_direct. */
  sellerReceivesCents: number;
}

/**
 * Compute the fee breakdown for a commerce event. Rounding is half-up to
 * whole cents so totals reconcile.
 */
export function calculateFees(
  surface: CommerceSurface,
  subjectPriceCents: number,
): ResolvedFees {
  if (!Number.isInteger(subjectPriceCents) || subjectPriceCents <= 0) {
    throw new Error("subjectPriceCents must be a positive integer");
  }

  const model = FEE_SCHEDULE[surface];

  if (model.kind === "patronage_direct") {
    // Patronage IS the seller — buyer pays the headline plus the Stripe
    // processing-fee gross-up so we retain the full headline.
    const { buyerTotalCents, stripeFeeCents } = grossUpForStripe(subjectPriceCents);
    return {
      subjectPriceCents,
      patronageRevenueCents: subjectPriceCents,
      thirdPartyOwedCents: 0,
      stripeFeeCents,
      buyerPaidTotalCents: buyerTotalCents,
      sellerReceivesCents: 0,
    };
  }

  // marketplace: buyer pays the sticker price + Stripe processing-fee gross-up.
  // Commission and royalty are deducted from the seller's payout internally —
  // they are NOT added on top of what the buyer pays.
  const commission = Math.round(subjectPriceCents * model.commissionRate);
  const royalty = model.royaltyRate
    ? Math.round(subjectPriceCents * model.royaltyRate)
    : 0;
  const { buyerTotalCents, stripeFeeCents } = grossUpForStripe(subjectPriceCents);
  return {
    subjectPriceCents,
    patronageRevenueCents: commission,
    thirdPartyOwedCents: royalty,
    stripeFeeCents,
    buyerPaidTotalCents: buyerTotalCents,
    sellerReceivesCents: subjectPriceCents - commission - royalty,
  };
}

/**
 * Backwards-compatible alias used by Phase 7 resale code. Equivalent to
 * calculateFees('resale', price) with names that match the original
 * resale_transactions column shape.
 */
export interface FeeBreakdown {
  salePriceCents: number;
  patronageCommissionCents: number;
  artistRoyaltyCents: number;
  stripeFeeCents: number;
  buyerPaidTotalCents: number;
  sellerReceivesCents: number;
}

export function calculateResaleFees(salePriceCents: number): FeeBreakdown {
  const f = calculateFees("resale", salePriceCents);
  return {
    salePriceCents: f.subjectPriceCents,
    patronageCommissionCents: f.patronageRevenueCents,
    artistRoyaltyCents: f.thirdPartyOwedCents,
    stripeFeeCents: f.stripeFeeCents,
    buyerPaidTotalCents: f.buyerPaidTotalCents,
    sellerReceivesCents: f.sellerReceivesCents,
  };
}

/**
 * Format cents → display string ("NZD 1,234.50"). For UI only — never use
 * this output to compute downstream values.
 */
export function formatCents(cents: number, currency: string = "NZD"): string {
  const value = (cents / 100).toLocaleString("en-NZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency} ${value}`;
}

/**
 * Default expiry for a fresh royalty hold. After this date, unclaimed
 * royalties are refunded to the seller.
 */
export function defaultHoldExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + ROYALTY_HOLD_DAYS);
  return d;
}
