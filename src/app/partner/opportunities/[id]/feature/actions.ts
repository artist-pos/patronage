"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCheckoutSession } from "@/lib/stripe";
import {
  PRICING_CURRENCY,
  getFeaturedPlan,
  grossUpForStripe,
} from "@/lib/commerce-pricing";

/**
 * Partner pays for a featured-listing boost. Stacks: a second purchase
 * extends `featured_until` from the current value (or now, whichever is
 * later) by `feature_days`. Idempotent on stripe_session_id.
 */
export async function initiateFeaturedListing(
  opportunityId: string,
  days: number,
): Promise<{ checkoutUrl?: string; error?: string }> {
  const plan = getFeaturedPlan(days);
  if (!plan) return { error: "Pick one of the available featured-listing plans." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { data: opp } = await admin
    .from("opportunities")
    .select("id, title, profile_id")
    .eq("id", opportunityId)
    .maybeSingle();
  if (!opp) return { error: "Opportunity not found." };
  if (opp.profile_id !== user.id) return { error: "Only the listing partner can feature." };

  const { data: payment, error: insertError } = await admin
    .from("featured_listing_payments")
    .insert({
      opportunity_id: opp.id,
      partner_id: user.id,
      amount_cents: plan.amountCents,
      currency: PRICING_CURRENCY,
      feature_days: plan.days,
    })
    .select("id")
    .single();
  if (insertError || !payment) {
    return { error: insertError?.message ?? "Couldn't create payment record." };
  }

  const { stripeFeeCents } = grossUpForStripe(plan.amountCents);

  let checkoutUrl: string;
  try {
    const session = await createCheckoutSession({
      purpose: "featured_listing",
      mode: "payment",
      buyerEmail: user.email ?? "",
      lineItems: [
        {
          amountCents: plan.amountCents,
          currency: PRICING_CURRENCY,
          productName: `Featured placement — ${opp.title}`,
          productDescription: `Promotes this opportunity in featured slots for ${plan.days} days.`,
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
        featured_payment_id: payment.id,
        opportunity_id: opp.id,
        feature_days: String(plan.days),
      },
      successPath: `/partner/opportunities/${opp.id}/edit?featured=success`,
      cancelPath: `/partner/opportunities/${opp.id}/edit`,
    });
    await admin
      .from("featured_listing_payments")
      .update({ stripe_session_id: session.sessionId })
      .eq("id", payment.id);
    checkoutUrl = session.url;
  } catch (err) {
    await admin.from("featured_listing_payments").delete().eq("id", payment.id);
    return { error: err instanceof Error ? err.message : "Stripe error." };
  }

  return { checkoutUrl };
}
