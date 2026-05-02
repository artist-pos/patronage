"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCheckoutSession } from "@/lib/stripe";
import {
  PIPELINE_ACTIVATION_PRICE_CENTS,
  PRICING_CURRENCY,
  grossUpForStripe,
} from "@/lib/commerce-pricing";

/**
 * Partner-initiated: pay to activate the Patronage pipeline application
 * flow for one of their opportunities. Idempotent on (opportunity_id,
 * status='paid') — re-clicking does nothing if already paid.
 */
export async function initiatePipelineActivation(
  opportunityId: string,
): Promise<{ checkoutUrl?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { data: opp } = await admin
    .from("opportunities")
    .select("id, title, profile_id, pipeline_paid_at, routing_type")
    .eq("id", opportunityId)
    .maybeSingle();
  if (!opp) return { error: "Opportunity not found." };
  if (opp.profile_id !== user.id) return { error: "Only the listing partner can activate." };
  if (opp.pipeline_paid_at) return { error: "Pipeline access is already active for this listing." };

  const { data: payment, error: insertError } = await admin
    .from("pipeline_entry_payments")
    .insert({
      opportunity_id: opp.id,
      partner_id: user.id,
      amount_cents: PIPELINE_ACTIVATION_PRICE_CENTS,
      currency: PRICING_CURRENCY,
    })
    .select("id")
    .single();
  if (insertError || !payment) {
    return { error: insertError?.message ?? "Couldn't create payment record." };
  }

  const { stripeFeeCents } = grossUpForStripe(PIPELINE_ACTIVATION_PRICE_CENTS);

  let checkoutUrl: string;
  try {
    const session = await createCheckoutSession({
      purpose: "pipeline_entry_fee",
      mode: "payment",
      buyerEmail: user.email ?? "",
      lineItems: [
        {
          amountCents: PIPELINE_ACTIVATION_PRICE_CENTS,
          currency: PRICING_CURRENCY,
          productName: `Pipeline activation — ${opp.title}`,
          productDescription:
            "Activates Patronage's pipeline submission flow for this opportunity.",
        },
        {
          amountCents: stripeFeeCents,
          currency: PRICING_CURRENCY,
          productName: "Processing fee",
          productDescription:
            "Covers third-party card processing (Stripe). Reflects Stripe's actual cost (NZ Commerce Commission requirement).",
        },
      ],
      metadata: {
        pipeline_payment_id: payment.id,
        opportunity_id: opp.id,
      },
      successPath: `/partner/opportunities/${opp.id}/edit?activation=success`,
      cancelPath: `/partner/opportunities/${opp.id}/edit`,
    });
    await admin
      .from("pipeline_entry_payments")
      .update({ stripe_session_id: session.sessionId })
      .eq("id", payment.id);
    checkoutUrl = session.url;
  } catch (err) {
    await admin.from("pipeline_entry_payments").delete().eq("id", payment.id);
    return { error: err instanceof Error ? err.message : "Stripe error." };
  }

  return { checkoutUrl };
}
