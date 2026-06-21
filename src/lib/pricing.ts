// Shared artist-facing pricing model.
//
// Single source of truth for the "what the artist receives vs what the buyer
// pays" breakdown shown in the new-work form, the editions editor, and the
// pricing calculator. Keeping this in one place means every breakdown emulates
// the calculator exactly.

export const PATRONAGE_COMMISSION_RATE = 0.1;      // 10% platform commission
export const STRIPE_PERCENT = 0.029;               // 2.9%
export const STRIPE_FIXED = 0.3;                   // + 30c

export interface PricingBreakdown {
  /** What the artist takes home (listed price minus commission). */
  youReceive: number;
  /** Patronage commission (10% of the listed price). */
  commission: number;
  /** The listed (sale) price the work is sold at. */
  listedPrice: number;
  /** Stripe processing the buyer pays on top of the listed price. */
  stripeProcessing: number;
  /** Total the buyer pays at checkout. */
  buyerPays: number;
}

/** Build a full breakdown from a known listed (sale) price. */
export function pricingFromListed(listedPrice: number): PricingBreakdown | null {
  if (!Number.isFinite(listedPrice) || listedPrice <= 0) return null;
  const commission = listedPrice * PATRONAGE_COMMISSION_RATE;
  const stripeProcessing = listedPrice * STRIPE_PERCENT + STRIPE_FIXED;
  return {
    youReceive: listedPrice - commission,
    commission,
    listedPrice,
    stripeProcessing,
    buyerPays: listedPrice + stripeProcessing,
  };
}

/**
 * Build a full breakdown from the net amount the artist wants to receive.
 * The listed price is grossed up so that, after commission, the artist nets
 * exactly the requested amount.
 */
export function pricingFromNet(net: number): PricingBreakdown | null {
  if (!Number.isFinite(net) || net <= 0) return null;
  return pricingFromListed(net / (1 - PATRONAGE_COMMISSION_RATE));
}
