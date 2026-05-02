import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Webhook handler for purpose=featured_listing. Marks the payment paid,
 * extends opportunities.featured_until by feature_days from max(now,
 * current_featured_until). Stacks correctly across repeat purchases.
 */
export async function handleFeaturedListingCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const paymentId = session.metadata?.featured_payment_id;
  if (!paymentId) {
    console.warn("[featured handler] missing featured_payment_id");
    return;
  }

  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("featured_listing_payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) {
    console.warn(`[featured handler] payment ${paymentId} not found`);
    return;
  }
  if (payment.status === "paid") return;

  const now = new Date();
  const paidAt = now.toISOString();
  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  // Stack: extend from the later of "now" or the current featured_until.
  const { data: opp } = await admin
    .from("opportunities")
    .select("featured_until")
    .eq("id", payment.opportunity_id)
    .maybeSingle();
  const startFrom = opp?.featured_until && new Date(opp.featured_until) > now
    ? new Date(opp.featured_until)
    : now;
  const featureUntil = new Date(startFrom);
  featureUntil.setDate(featureUntil.getDate() + payment.feature_days);

  await admin
    .from("featured_listing_payments")
    .update({
      status: "paid",
      stripe_session_id: session.id,
      stripe_payment_intent: paymentIntent,
      paid_at: paidAt,
      feature_until: featureUntil.toISOString(),
    })
    .eq("id", payment.id);

  await admin
    .from("opportunities")
    .update({
      is_featured: true,
      featured_until: featureUntil.toISOString(),
    })
    .eq("id", payment.opportunity_id);
}
