import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { verifyWebhook } from "@/lib/stripe";
import { handleResaleCompleted } from "@/lib/commerce/resale-handler";
import { handlePrimarySaleCompleted, handlePrimaryPaymentIntentSucceeded } from "@/lib/commerce/primary-sale-handler";
import { handlePipelineEntryCompleted } from "@/lib/commerce/pipeline-handler";
import { handleFeaturedListingCompleted } from "@/lib/commerce/featured-handler";
import {
  handleSupportCompleted,
  handleSupportInvoicePaid,
  handleSupportSubscriptionDeleted,
  handleSupportInvoiceFailed,
} from "@/lib/commerce/support-handler";
import { handlePartnerSubmissionCompleted } from "@/lib/commerce/partner-submission-handler";
import { handleNegotiatedSaleCompleted } from "@/lib/commerce/negotiated-sale-handler";
import { handleCampaignSaleCompleted } from "@/lib/commerce/campaign-sale-handler";
import type { CheckoutPurpose } from "@/lib/stripe";

// Stripe needs the raw body to verify the signature.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CompletedHandler = (session: Stripe.Checkout.Session) => Promise<void>;

/**
 * Each commerce surface registers its `checkout.session.completed` handler
 * here. Adding a new surface = add an entry. The webhook stays a thin
 * dispatcher; per-surface logic lives in src/lib/commerce/<surface>.ts.
 */
const COMPLETED_HANDLERS: Partial<Record<CheckoutPurpose, CompletedHandler>> = {
  resale: handleResaleCompleted,
  primary_sale: handlePrimarySaleCompleted,
  negotiated_sale: handleNegotiatedSaleCompleted,
  campaign_sale: handleCampaignSaleCompleted,
  pipeline_entry_fee: handlePipelineEntryCompleted,
  featured_listing: handleFeaturedListingCompleted,
  support_one_off: handleSupportCompleted,
  support_recurring: handleSupportCompleted,
  partner_submission: handlePartnerSubmissionCompleted,
};

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new NextResponse("Missing signature", { status: 400 });

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = verifyWebhook(rawBody, signature);
  } catch (err) {
    console.error("[stripe webhook] signature verify failed", err);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const purpose = session.metadata?.purpose as CheckoutPurpose | undefined;
        if (!purpose) {
          console.warn("[stripe webhook] session missing metadata.purpose", session.id);
          return NextResponse.json({ received: true, dispatched: false });
        }
        const handler = COMPLETED_HANDLERS[purpose];
        if (!handler) {
          console.warn(`[stripe webhook] no handler registered for purpose=${purpose}`);
          return NextResponse.json({ received: true, dispatched: false });
        }
        await handler(session);
        break;
      }
      // Subscription lifecycle — only the support_recurring surface uses
      // these. Each handler no-ops for unknown subscription ids so other
      // surfaces' subscription events (none today) don't error.
      case "invoice.paid":
        await handleSupportInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case "invoice.payment_failed":
        await handleSupportInvoiceFailed(event.data.object as Stripe.Invoice);
        break;
      case "customer.subscription.deleted":
        await handleSupportSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        if (intent.metadata?.purpose === "primary_sale") {
          await handlePrimaryPaymentIntentSucceeded(intent);
        }
        break;
      }
    }
  } catch (err) {
    console.error("[stripe webhook] handler error", err);
    // Returning 500 tells Stripe to retry — preferred over silently swallowing.
    return new NextResponse("Handler error", { status: 500 });
  }

  return NextResponse.json({ received: true });
}
