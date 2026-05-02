import type Stripe from "stripe";
import { handleFeaturedListingCompleted } from "@/lib/commerce/featured-handler";
import { handlePipelineEntryCompleted } from "@/lib/commerce/pipeline-handler";

/**
 * Combined-checkout handler used by the partner submission flow when the
 * partner pays for featured placement, pipeline activation, or both in a
 * single Stripe session. Dispatches to whichever per-surface handlers have
 * a corresponding payment row referenced in the session metadata.
 */
export async function handlePartnerSubmissionCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  if (session.metadata?.featured_payment_id) {
    await handleFeaturedListingCompleted(session);
  }
  if (session.metadata?.pipeline_payment_id) {
    await handlePipelineEntryCompleted(session);
  }
}
