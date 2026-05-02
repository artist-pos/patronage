"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateResaleFees } from "@/lib/commerce-fee";
import { createResaleCheckout } from "@/lib/stripe";

interface InitiateInput {
  membershipId: string;
  buyerEmail: string;
  buyerName?: string | null;
  /** What the seller wants to receive — entered as whole units (e.g. NZD). */
  salePriceMajor: number;
  currency?: string;
}

/**
 * Create a pending resale_transactions row + a Stripe Checkout session and
 * return the URL the seller redirects the buyer to. Idempotent on
 * (membershipId, buyer_email) only at the table-row level — re-clicking
 * "Transfer" creates a new pending session.
 */
export async function initiateResale(
  input: InitiateInput,
): Promise<{ checkoutUrl?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const buyerEmail = input.buyerEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) {
    return { error: "Enter a valid buyer email." };
  }
  if (!Number.isFinite(input.salePriceMajor) || input.salePriceMajor <= 0) {
    return { error: "Sale price must be a positive number." };
  }
  const salePriceCents = Math.round(input.salePriceMajor * 100);
  const currency = (input.currency ?? "NZD").toUpperCase();
  const fees = calculateResaleFees(salePriceCents);

  const admin = createAdminClient();

  // Caller must own the membership row (i.e. the work is in their vault).
  const { data: membership } = await admin
    .from("collection_membership")
    .select("id, holder_id, artwork_id")
    .eq("id", input.membershipId)
    .maybeSingle();
  if (!membership) return { error: "Work not found in your collection." };
  if (membership.holder_id !== user.id) {
    return { error: "Only the holder can resell this work." };
  }

  const { data: artwork } = await admin
    .from("artworks")
    .select("id, title, caption, url, ledger_id, current_owner_id")
    .eq("id", membership.artwork_id)
    .maybeSingle();
  if (!artwork) return { error: "Artwork not found." };
  if (artwork.current_owner_id !== user.id) {
    return { error: "Only the current owner can resell this work." };
  }

  // Insert the pending row first so the Stripe session can reference its id.
  const { data: resale, error: resaleError } = await admin
    .from("resale_transactions")
    .insert({
      artwork_id: artwork.id,
      seller_id: user.id,
      buyer_email: buyerEmail,
      buyer_name: input.buyerName?.trim() || null,
      sale_price_cents: salePriceCents,
      currency,
      patronage_commission_cents: fees.patronageCommissionCents,
      artist_royalty_cents: fees.artistRoyaltyCents,
      buyer_paid_total_cents: fees.buyerPaidTotalCents,
    })
    .select("id")
    .single();
  if (resaleError || !resale) {
    return { error: resaleError?.message ?? "Couldn't create resale record." };
  }

  let checkoutUrl: string;
  try {
    const session = await createResaleCheckout({
      resaleTransactionId: resale.id,
      artworkId: artwork.id,
      workTitle: artwork.title ?? artwork.caption ?? "Artwork",
      workImageUrl: artwork.url ?? null,
      buyerEmail,
      workSubtotalCents: fees.buyerPaidTotalCents - fees.stripeFeeCents,
      stripeFeeCents: fees.stripeFeeCents,
      currency,
      ledgerId: artwork.ledger_id,
    });
    await admin
      .from("resale_transactions")
      .update({ stripe_session_id: session.sessionId })
      .eq("id", resale.id);
    checkoutUrl = session.url;
  } catch (err) {
    // Roll back the pending row so we don't leave orphan rows behind a
    // failed Stripe call.
    await admin.from("resale_transactions").delete().eq("id", resale.id);
    return { error: err instanceof Error ? err.message : "Stripe error." };
  }

  return { checkoutUrl };
}
