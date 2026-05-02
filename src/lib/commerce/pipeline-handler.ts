import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Webhook handler for purpose=pipeline_entry_fee. Flips the payment row to
 * 'paid' and stamps `opportunities.pipeline_paid_at` so the rendering layer
 * can gate the pipeline submission form on payment.
 */
export async function handlePipelineEntryCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const paymentId = session.metadata?.pipeline_payment_id;
  if (!paymentId) {
    console.warn("[pipeline handler] missing pipeline_payment_id");
    return;
  }

  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("pipeline_entry_payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) {
    console.warn(`[pipeline handler] payment ${paymentId} not found`);
    return;
  }
  if (payment.status === "paid") return;

  const paidAt = new Date().toISOString();
  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  await admin
    .from("pipeline_entry_payments")
    .update({
      status: "paid",
      stripe_session_id: session.id,
      stripe_payment_intent: paymentIntent,
      paid_at: paidAt,
    })
    .eq("id", payment.id);

  await admin
    .from("opportunities")
    .update({ pipeline_paid_at: paidAt })
    .eq("id", payment.opportunity_id);
}
