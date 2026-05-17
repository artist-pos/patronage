"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateFees } from "@/lib/commerce-fee";
import { createCheckoutSession, getStripe } from "@/lib/stripe";
import type { ResolvedFees } from "@/lib/commerce-fee";

interface BuyInput {
  artworkId: string;
  buyerEmail: string;
  buyerName?: string;
}

/**
 * Start a primary sale of an artist's available work. Anyone can initiate
 * (the artist's "Buy" button is public) — the buyer doesn't need a Patronage
 * account; they enter their email and pay via Stripe Checkout.
 */
export async function initiatePrimarySale(
  input: BuyInput,
): Promise<{ checkoutUrl?: string; error?: string }> {
  const buyerEmail = input.buyerEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) {
    return { error: "Enter a valid email." };
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  // Fetch the artwork with its sticker price. Artworks store price as text
  // (e.g. "1200" or "1,200") plus a currency code — parse defensively.
  const { data: artwork } = await admin
    .from("artworks")
    .select("id, title, caption, url, price_cents, is_poa, price_currency, is_available, creator_id, current_owner_id")
    .eq("id", input.artworkId)
    .maybeSingle();

  if (!artwork) return { error: "Artwork not found." };
  if (!artwork.is_available) return { error: "This work isn't available for sale." };
  if (artwork.creator_id !== artwork.current_owner_id) {
    return { error: "This work has already changed hands. Use the resale flow." };
  }
  if (artwork.is_poa || !artwork.price_cents || artwork.price_cents <= 0) {
    return { error: "This work has no listed price." };
  }

  const subjectPriceCents = artwork.price_cents;
  const currency = (artwork.price_currency ?? "NZD").toUpperCase();
  const fees = calculateFees("primary_sale", subjectPriceCents);

  // Logged-in buyer? Capture their id so the webhook can skip shadow-account
  // creation. Anonymous buyers are fine — webhook creates a shadow account.
  const { data: { user } } = await supabase.auth.getUser();

  // Check if artist has Stripe Connect enabled — if so, use automatic payout.
  const { data: artistProfile } = await admin
    .from("profiles")
    .select("stripe_account_id, stripe_connect_status")
    .eq("id", artwork.creator_id)
    .maybeSingle();

  const useConnect =
    artistProfile?.stripe_connect_status === "enabled" &&
    !!artistProfile?.stripe_account_id;

  const payoutMethod = useConnect ? "stripe_connect" : "manual";

  const { data: row, error: insertError } = await admin
    .from("primary_sale_transactions")
    .insert({
      artwork_id: artwork.id,
      artist_id: artwork.creator_id,
      buyer_id: user?.id ?? null,
      buyer_email: buyerEmail,
      buyer_name: input.buyerName?.trim() || null,
      sale_price_cents: subjectPriceCents,
      currency,
      patronage_commission_cents: fees.patronageRevenueCents,
      buyer_paid_total_cents: fees.buyerPaidTotalCents,
      payout_method: payoutMethod,
    })
    .select("id")
    .single();
  if (insertError || !row) {
    return { error: insertError?.message ?? "Couldn't create sale record." };
  }

  let checkoutUrl: string;
  try {
    const session = await createCheckoutSession({
      purpose: "primary_sale",
      mode: "payment",
      buyerEmail,
      lineItems: [
        {
          amountCents: fees.buyerPaidTotalCents - fees.stripeFeeCents,
          currency,
          productName: artwork.title ?? artwork.caption ?? "Artwork",
          productImageUrl: artwork.url,
          productDescription: "Primary sale via Patronage. Includes 10% commission.",
        },
        {
          amountCents: fees.stripeFeeCents,
          currency,
          productName: "Processing fee",
          productDescription:
            "Covers third-party card processing (Stripe). Required so the artist receives the full sale price.",
        },
      ],
      metadata: {
        primary_sale_id: row.id,
        artwork_id: artwork.id,
      },
      ...(useConnect
        ? {
            connectedAccountId: artistProfile!.stripe_account_id!,
            applicationFeeCents: fees.stripeFeeCents + fees.patronageRevenueCents,
          }
        : {}),
    });
    await admin
      .from("primary_sale_transactions")
      .update({ stripe_session_id: session.sessionId })
      .eq("id", row.id);
    checkoutUrl = session.url;
  } catch (err) {
    await admin.from("primary_sale_transactions").delete().eq("id", row.id);
    return { error: err instanceof Error ? err.message : "Stripe error." };
  }

  return { checkoutUrl };
}

/**
 * Create an embedded Checkout Session for in-modal payment.
 * Uses ui_mode:"custom" so we keep our own UI while Stripe handles PCI scope.
 * Fires checkout.session.completed on completion — same webhook as the redirect flow.
 */
export async function createPrimaryEmbeddedCheckout(input: {
  artworkId: string;
  editionId?: string | null;
  buyerEmail: string;
}): Promise<{ clientSecret?: string; fees?: ResolvedFees; error?: string }> {
  const buyerEmail = input.buyerEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) {
    return { error: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: artwork } = await admin
    .from("artworks")
    .select("id, title, caption, url, price_cents, is_poa, price_currency, is_available, creator_id, current_owner_id")
    .eq("id", input.artworkId)
    .maybeSingle();

  if (!artwork) return { error: "Artwork not found." };
  if (!artwork.is_available) return { error: "This work isn't available for sale." };
  if (artwork.creator_id !== artwork.current_owner_id) {
    return { error: "This work has already changed hands. Use the resale flow." };
  }

  let priceCents = artwork.price_cents;
  let editionLabel: string | null = null;

  if (input.editionId) {
    const { data: edition } = await admin
      .from("editions")
      .select("price_cents, label, poa, listed")
      .eq("id", input.editionId)
      .maybeSingle();
    if (edition?.listed && !edition.poa && edition.price_cents != null) {
      priceCents = edition.price_cents;
      editionLabel = edition.label;
    }
  }

  if (artwork.is_poa || !priceCents || priceCents <= 0) {
    return { error: "This work has no listed price." };
  }

  const fees = calculateFees("primary_sale", priceCents);
  const currency = (artwork.price_currency ?? "NZD").toUpperCase();

  const [{ data: { user } }, artistProfileResult] = await Promise.all([
    supabase.auth.getUser(),
    admin.from("profiles").select("stripe_account_id, stripe_connect_status").eq("id", artwork.creator_id).maybeSingle(),
  ]);
  const artistProfile = artistProfileResult.data;
  const useConnect = artistProfile?.stripe_connect_status === "enabled" && !!artistProfile?.stripe_account_id;

  const { data: row, error: insertError } = await admin
    .from("primary_sale_transactions")
    .insert({
      artwork_id: artwork.id,
      artist_id: artwork.creator_id,
      buyer_id: user?.id ?? null,
      buyer_email: buyerEmail,
      sale_price_cents: priceCents,
      currency,
      patronage_commission_cents: fees.patronageRevenueCents,
      buyer_paid_total_cents: fees.buyerPaidTotalCents,
      payout_method: useConnect ? "stripe_connect" : "manual",
      edition_id: input.editionId ?? null,
    })
    .select("id")
    .single();

  if (insertError || !row) {
    return { error: insertError?.message ?? "Couldn't create sale record." };
  }

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      ui_mode: "elements",
      mode: "payment",
      customer_email: buyerEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: fees.buyerPaidTotalCents - fees.stripeFeeCents,
            product_data: {
              name: artwork.title ?? artwork.caption ?? "Artwork",
              images: artwork.url ? [artwork.url] : undefined,
              description: "Primary sale via Patronage. Includes 10% commission.",
            },
          },
        },
        {
          quantity: 1,
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: fees.stripeFeeCents,
            product_data: {
              name: "Processing fee",
              description: "Covers third-party card processing. Required so the artist receives the full sale price.",
            },
          },
        },
      ],
      metadata: {
        purpose: "primary_sale",
        primary_sale_id: row.id,
        artwork_id: artwork.id,
        edition_id: input.editionId ?? "",
        edition_label: editionLabel ?? "",
        buyer_email: buyerEmail,
      },
      payment_intent_data: {
        metadata: {
          purpose: "primary_sale",
          primary_sale_id: row.id,
          artwork_id: artwork.id,
        },
        ...(useConnect && artistProfile?.stripe_account_id
          ? {
              application_fee_amount: fees.stripeFeeCents + fees.patronageRevenueCents,
              transfer_data: { destination: artistProfile.stripe_account_id },
            }
          : {}),
      },
      return_url: `${SITE_URL}/sale/success?session_id={CHECKOUT_SESSION_ID}`,
    });

    await admin
      .from("primary_sale_transactions")
      .update({ stripe_session_id: session.id })
      .eq("id", row.id);

    return { clientSecret: session.client_secret ?? undefined, fees };
  } catch (err) {
    await admin.from("primary_sale_transactions").delete().eq("id", row.id);
    return { error: err instanceof Error ? err.message : "Stripe error." };
  }
}

