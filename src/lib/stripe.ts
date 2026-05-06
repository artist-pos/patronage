import Stripe from "stripe";
import type { CommerceSurface } from "@/lib/commerce-fee";

/**
 * Single Stripe client used by every commerce surface (resale, primary
 * sale, pipeline entry fees, featured listings, support tiers). Throws on
 * missing env so misconfigurations fail at boot rather than at first
 * checkout. Environment variables required:
 *
 *   STRIPE_SECRET_KEY      — sk_test_... locally, sk_live_... in prod
 *   STRIPE_WEBHOOK_SECRET  — from `stripe listen` or the dashboard webhook
 *   NEXT_PUBLIC_SITE_URL   — used to build success/cancel URLs
 */

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  cached = new Stripe(key, {
    // Pin the API version so a Stripe upgrade can't silently change behaviour.
    apiVersion: "2026-04-22.dahlia",
    typescript: true,
  });
  return cached;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

/** Webhook handlers dispatch on this. Always set on every session. */
export type CheckoutPurpose = CommerceSurface;

export interface CheckoutLineItemInput {
  /** Total cents the buyer's card will be charged for this line. */
  amountCents: number;
  currency: string;
  productName: string;
  productDescription?: string;
  productImageUrl?: string | null;
}

export interface CreateCheckoutInput {
  purpose: CheckoutPurpose;
  /** 'payment' for one-shot purchases, 'subscription' for recurring. */
  mode: "payment" | "subscription";
  buyerEmail: string;
  lineItems: CheckoutLineItemInput[];
  /**
   * Forwarded onto the Stripe session. Keep it tight — `purpose` plus the
   * id of whatever transaction row this belongs to. Webhook handlers read
   * additional metadata fields per surface.
   */
  metadata: Record<string, string>;
  /** Defaults derive from `purpose` if not supplied. */
  successPath?: string;
  cancelPath?: string;
}

const DEFAULT_SUCCESS_PATHS: Record<CheckoutPurpose, string> = {
  resale:             "/resale/success?session_id={CHECKOUT_SESSION_ID}",
  primary_sale:       "/sale/success?session_id={CHECKOUT_SESSION_ID}",
  negotiated_sale:    "/messages?transferred=1",
  support_one_off:    "/support/success?session_id={CHECKOUT_SESSION_ID}",
  support_recurring:  "/support/success?session_id={CHECKOUT_SESSION_ID}",
  pipeline_entry_fee: "/opportunities/applied?session_id={CHECKOUT_SESSION_ID}",
  featured_listing:   "/partner/dashboard?session_id={CHECKOUT_SESSION_ID}",
  partner_submission: "/partner/dashboard?submission=success&session_id={CHECKOUT_SESSION_ID}",
};

const DEFAULT_CANCEL_PATHS: Record<CheckoutPurpose, string> = {
  resale:             "/dashboard/collection",
  primary_sale:       "/",
  negotiated_sale:    "/messages",
  support_one_off:    "/",
  support_recurring:  "/",
  pipeline_entry_fee: "/opportunities",
  featured_listing:   "/partner/dashboard",
  partner_submission: "/partner/dashboard?submission=cancelled",
};

/**
 * Create a Stripe Checkout session for any commerce surface. Returns the
 * session id (for our DB record) and the URL the buyer should be sent to.
 *
 * Stripe-hosted payment UI keeps us out of PCI scope. Webhook on
 * `checkout.session.completed` does the post-payment work — never trust
 * the success-page redirect to be the source of truth.
 */
export async function createCheckoutSession(input: CreateCheckoutInput): Promise<{
  sessionId: string;
  url: string;
}> {
  const stripe = getStripe();

  const successUrl =
    `${SITE_URL}${input.successPath ?? DEFAULT_SUCCESS_PATHS[input.purpose]}`;
  const cancelUrl =
    `${SITE_URL}${input.cancelPath ?? DEFAULT_CANCEL_PATHS[input.purpose]}`;

  const session = await stripe.checkout.sessions.create({
    mode: input.mode,
    customer_email: input.buyerEmail,
    line_items: input.lineItems.map((line) => ({
      quantity: 1,
      price_data: {
        currency: line.currency.toLowerCase(),
        unit_amount: line.amountCents,
        product_data: {
          name: line.productName,
          images: line.productImageUrl ? [line.productImageUrl] : undefined,
          description: line.productDescription,
        },
        // For subscription mode Stripe needs an interval. Callers building
        // recurring sessions should add their own price config — at that
        // point the line-item shape isn't enough and they'd build the
        // session directly via getStripe().
        ...(input.mode === "subscription"
          ? { recurring: { interval: "month" as const } }
          : {}),
      },
    })),
    metadata: { purpose: input.purpose, ...input.metadata },
    payment_intent_data:
      input.mode === "payment"
        ? { metadata: { purpose: input.purpose, ...input.metadata } }
        : undefined,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  if (!session.url) throw new Error("Stripe didn't return a checkout URL");
  return { sessionId: session.id, url: session.url };
}

// Backwards-compat thin wrapper — Phase 7 resale code still calls this.
// New surfaces should call createCheckoutSession directly.

export interface ResaleCheckoutInput {
  resaleTransactionId: string;
  artworkId: string;
  workTitle: string;
  workImageUrl: string | null;
  buyerEmail: string;
  /** Total before the Stripe processing-fee passthrough is added. */
  workSubtotalCents: number;
  /** Stripe fee passthrough — itemised separately on Stripe checkout for
   *  NZ Commerce Commission disclosure compliance. */
  stripeFeeCents: number;
  currency: string;
  ledgerId: string | null;
}

export async function createResaleCheckout(input: ResaleCheckoutInput): Promise<{
  sessionId: string;
  url: string;
}> {
  return createCheckoutSession({
    purpose: "resale",
    mode: "payment",
    buyerEmail: input.buyerEmail,
    lineItems: [
      {
        amountCents: input.workSubtotalCents,
        currency: input.currency,
        productName: input.workTitle,
        productImageUrl: input.workImageUrl,
        productDescription:
          "Resale via Patronage. Includes 10% commission and 5% artist royalty.",
      },
      {
        amountCents: input.stripeFeeCents,
        currency: input.currency,
        productName: "Processing fee",
        productDescription:
          "Covers third-party card processing (Stripe). Required so the seller receives the full sale price.",
      },
    ],
    metadata: {
      resale_transaction_id: input.resaleTransactionId,
      artwork_id: input.artworkId,
      ledger_id: input.ledgerId ?? "",
    },
  });
}

/**
 * Issue a full refund against a Stripe PaymentIntent. Throws on Stripe error
 * so callers can abort their DB writes cleanly.
 */
export async function createRefund(paymentIntentId: string): Promise<Stripe.Refund> {
  const stripe = getStripe();
  return stripe.refunds.create({ payment_intent: paymentIntentId });
}

/**
 * Verify the webhook signature using the raw request body. Throws if the
 * signature is invalid or the secret is missing — never trust an unverified
 * webhook payload.
 */
export function verifyWebhook(rawBody: string, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}
