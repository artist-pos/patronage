"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateFees } from "@/lib/commerce-fee";
import { createCheckoutSession } from "@/lib/stripe";

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
    .select("id, title, caption, url, price, price_currency, is_available, creator_id, current_owner_id")
    .eq("id", input.artworkId)
    .maybeSingle();

  if (!artwork) return { error: "Artwork not found." };
  if (!artwork.is_available) return { error: "This work isn't available for sale." };
  if (artwork.creator_id !== artwork.current_owner_id) {
    // Defensive: a primary sale should only happen on works the creator
    // still owns. Resale path handles the other case.
    return { error: "This work has already changed hands. Use the resale flow." };
  }

  const priceMajor = parsePriceMajor(artwork.price);
  if (priceMajor === null || priceMajor <= 0) {
    return { error: "This work has no listed price." };
  }

  const subjectPriceCents = Math.round(priceMajor * 100);
  const currency = (artwork.price_currency ?? "NZD").toUpperCase();
  const fees = calculateFees("primary_sale", subjectPriceCents);

  // Logged-in buyer? Capture their id so the webhook can skip shadow-account
  // creation. Anonymous buyers are fine — webhook creates a shadow account.
  const { data: { user } } = await supabase.auth.getUser();

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
 * Parse the artwork's free-text price into a number of major units. Strip
 * non-numeric except the decimal point. Returns null if nothing usable.
 */
function parsePriceMajor(price: string | null): number | null {
  if (!price) return null;
  const cleaned = price.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const value = parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}
