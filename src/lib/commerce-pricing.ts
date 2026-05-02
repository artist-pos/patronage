/**
 * Patronage-direct pricing. These are the prices Patronage charges partners
 * directly (no third-party split). Adjust here, not in the call sites.
 *
 * All amounts in minor units (cents). Currency NZD for v1.
 */

export const PRICING_CURRENCY = "NZD";

/**
 * Stripe processing-fee passthrough. Stripe NZ domestic cards: 2.9% + $0.30.
 * International cards run ~3.9%; we absorb that ~1% gap into our commission
 * rather than gross up to the worst case (NZ Commerce Commission requires
 * surcharges to reflect *actual* cost — overcharging would breach that).
 *
 * NZ legal context: surcharges must be disclosed up-front (no drip pricing)
 * and may not exceed Stripe's actual fee. Reflect both at every checkout.
 */
export const STRIPE_PASSTHROUGH_PCT = 0.029;
export const STRIPE_FIXED_FEE_CENTS = 30;

/**
 * Gross up a base amount so that, after Stripe's processing fee comes off
 * the top, Patronage retains its full intended cut. Returns the buyer's
 * total *and* the Stripe fee component for itemised display.
 *
 * Formula: total = (base + fixed) / (1 - pct)
 *          stripeFee = total - base
 */
export function grossUpForStripe(baseAmountCents: number): {
  buyerTotalCents: number;
  stripeFeeCents: number;
} {
  const buyerTotalCents = Math.ceil(
    (baseAmountCents + STRIPE_FIXED_FEE_CENTS) / (1 - STRIPE_PASSTHROUGH_PCT),
  );
  const stripeFeeCents = buyerTotalCents - baseAmountCents;
  return { buyerTotalCents, stripeFeeCents };
}

/** One-shot fee for activating Patronage's pipeline submission flow on an
 *  opportunity. Partners with `routing_type = 'external'` pay nothing.
 *  First round per partner is free — see `isPipelineFirstRound`. */
export const PIPELINE_ACTIVATION_PRICE_CENTS = 200_00;  // NZD 200

/** Featured-listing boost. Single SKU for v1; matches the $75 price
 *  advertised on the partners page. */
export interface FeaturedListingPlan {
  days: number;
  amountCents: number;
  label: string;
}

export const FEATURED_LISTING_PLANS: FeaturedListingPlan[] = [
  { days: 30, amountCents: 75_00, label: "30 days" },
];

export function getFeaturedPlan(days: number): FeaturedListingPlan | null {
  return FEATURED_LISTING_PLANS.find((p) => p.days === days) ?? null;
}
