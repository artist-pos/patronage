import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyOpportunitySubmission, sendPartnerPaymentReceived } from "@/lib/email";
import { createNotification } from "@/lib/notifications";

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

  // Tell the partner we have their payment, and put the listing in front of admins.
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
    const { data: opp } = await admin
      .from("opportunities")
      .select("id, title, organiser, routing_type, profile_id, status")
      .eq("id", payment.opportunity_id)
      .maybeSingle();
    if (opp?.profile_id) {
      const { data: partnerAuth } = await admin.auth.admin.getUserById(opp.profile_id as string);
      const partnerEmail = partnerAuth?.user?.email;
      const manageUrl = `${siteUrl}/partner/opportunities/${opp.id}/manage`;
      if (partnerEmail) {
        await sendPartnerPaymentReceived({
          partnerEmail,
          opportunityTitle: (opp.title as string) || "your open call",
          url: manageUrl,
        });
      }
      await createNotification(
        opp.profile_id as string,
        "note",
        "Payment received",
        `The publishing fee for ${(opp.title as string) || "your open call"} has been received. It will go live once reviewed.`,
        `/partner/opportunities/${opp.id}/manage`,
      );
      if (opp.status === "pending") {
        await notifyOpportunitySubmission({
          title: (opp.title as string) ?? "",
          organiser: (opp.organiser as string) ?? "",
          type: (opp.routing_type as string) ?? "pipeline",
          submitterEmail: partnerEmail ?? null,
          isFeatured: false,
          isPipeline: true,
          adminUrl: `${siteUrl}/admin/opportunities/${opp.id}`,
        });
      }
    }
  } catch (err) {
    console.error("[pipeline handler] post-payment notices failed:", err);
  }
}
