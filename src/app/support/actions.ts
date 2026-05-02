"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateFees } from "@/lib/commerce-fee";
import { createCheckoutSession, getStripe } from "@/lib/stripe";

interface SupportInput {
  tierId: string;
  /** Required for anonymous supporters; ignored when the user is logged in. */
  supporterEmail?: string;
  supporterName?: string;
}

/**
 * Start a support payment. One-off tiers go through Stripe Checkout in
 * 'payment' mode; recurring tiers in 'subscription' mode. Stripe Prices are
 * minted lazily on first checkout and cached on the support_tiers row so we
 * don't maintain a separate sync job.
 */
export async function initiateSupportCheckout(
  input: SupportInput,
): Promise<{ checkoutUrl?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const supporterEmail = (user?.email ?? input.supporterEmail ?? "").trim().toLowerCase();
  if (!supporterEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supporterEmail)) {
    return { error: "Enter a valid email." };
  }

  const admin = createAdminClient();
  const { data: tier } = await admin
    .from("support_tiers")
    .select("id, profile_id, title, description, price, tier_type, is_active, stripe_price_id, stripe_product_id")
    .eq("id", input.tierId)
    .maybeSingle();
  if (!tier) return { error: "Tier not found." };
  if (!tier.is_active) return { error: "This tier isn't active." };
  if (tier.tier_type !== "one_off" && tier.tier_type !== "recurring") {
    return { error: "Only one-off and recurring tiers can be paid online." };
  }

  // Tiers store price as a NUMERIC of major units. Convert to cents up front.
  const subjectPriceCents = Math.round(tier.price * 100);
  const surface = tier.tier_type === "recurring" ? "support_recurring" : "support_one_off";
  const fees = calculateFees(surface, subjectPriceCents);
  const currency = "NZD";

  const { data: subscription, error: insertError } = await admin
    .from("support_subscriptions")
    .insert({
      tier_id: tier.id,
      recipient_id: tier.profile_id,
      supporter_id: user?.id ?? null,
      supporter_email: supporterEmail,
      supporter_name: input.supporterName?.trim() || null,
      amount_cents: fees.subjectPriceCents,
      currency,
      patronage_commission_cents: fees.patronageRevenueCents,
      buyer_paid_total_cents: fees.buyerPaidTotalCents,
      tier_type: tier.tier_type,
    })
    .select("id")
    .single();
  if (insertError || !subscription) {
    return { error: insertError?.message ?? "Couldn't create support record." };
  }

  // Mint the Stripe Price lazily and cache it on the tier. Recurring uses
  // a recurring price; one-off uses a one-time price. Re-mint when the
  // cached price's unit_amount no longer matches the current grossed-up
  // total (e.g. after a fee policy change). Stripe Prices are immutable,
  // so we mint a new one and overwrite the cached id.
  let priceId = tier.stripe_price_id;
  if (priceId) {
    try {
      const cached = await getStripe().prices.retrieve(priceId);
      if (cached.unit_amount !== fees.buyerPaidTotalCents) priceId = null;
    } catch {
      priceId = null; // cached id no longer exists in Stripe
    }
  }
  if (!priceId) {
    try {
      priceId = await ensureStripePrice(
        tier.id,
        tier.title,
        tier.description,
        fees.buyerPaidTotalCents,
        currency,
        tier.tier_type,
        tier.stripe_product_id,
      );
    } catch (err) {
      await admin.from("support_subscriptions").delete().eq("id", subscription.id);
      return { error: err instanceof Error ? err.message : "Stripe price error." };
    }
  }

  const stripe = getStripe();
  let checkoutUrl: string;
  try {
    // Subscription mode needs a price id rather than price_data, so we go
    // direct to stripe.checkout.sessions.create here. Payment-mode could
    // reuse createCheckoutSession; doing both via the same call keeps the
    // flow consistent.
    const isRecurring = tier.tier_type === "recurring";
    const session = await stripe.checkout.sessions.create({
      mode: isRecurring ? "subscription" : "payment",
      customer_email: supporterEmail,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        purpose: surface,
        support_subscription_id: subscription.id,
      },
      payment_intent_data: !isRecurring
        ? { metadata: { purpose: surface, support_subscription_id: subscription.id } }
        : undefined,
      subscription_data: isRecurring
        ? { metadata: { purpose: surface, support_subscription_id: subscription.id } }
        : undefined,
      success_url: `${siteUrl()}/support/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl()}/`,
    });
    if (!session.url) throw new Error("Stripe didn't return a checkout URL");
    await admin
      .from("support_subscriptions")
      .update({ stripe_session_id: session.id })
      .eq("id", subscription.id);
    checkoutUrl = session.url;
  } catch (err) {
    await admin.from("support_subscriptions").delete().eq("id", subscription.id);
    return { error: err instanceof Error ? err.message : "Stripe error." };
  }

  // Silence unused-import warning when this file is imported but only the
  // generic createCheckoutSession path runs in tests.
  void createCheckoutSession;
  return { checkoutUrl };
}

/**
 * Open a Stripe Customer Portal session so a supporter can manage / cancel
 * a recurring subscription. Returns the portal URL.
 */
export async function openSupportCustomerPortal(): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { data: latest } = await admin
    .from("support_subscriptions")
    .select("stripe_customer_id")
    .eq("supporter_id", user.id)
    .not("stripe_customer_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest?.stripe_customer_id) {
    return { error: "No active subscription on file." };
  }

  const stripe = getStripe();
  const portal = await stripe.billingPortal.sessions.create({
    customer: latest.stripe_customer_id,
    return_url: `${siteUrl()}/dashboard`,
  });
  return { url: portal.url };
}

async function ensureStripePrice(
  tierId: string,
  title: string,
  description: string | null,
  amountCents: number,
  currency: string,
  tierType: 'one_off' | 'recurring',
  cachedProductId: string | null,
): Promise<string> {
  const stripe = getStripe();
  const productId = cachedProductId ?? (await stripe.products.create({
    name: title,
    description: description ?? undefined,
    metadata: { support_tier_id: tierId },
  })).id;

  const price = await stripe.prices.create({
    product: productId,
    currency: currency.toLowerCase(),
    unit_amount: amountCents,
    ...(tierType === "recurring" ? { recurring: { interval: "month" } } : {}),
    metadata: { support_tier_id: tierId, tier_type: tierType },
  });

  const admin = createAdminClient();
  await admin
    .from("support_tiers")
    .update({ stripe_price_id: price.id, stripe_product_id: productId })
    .eq("id", tierId);
  return price.id;
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
}
