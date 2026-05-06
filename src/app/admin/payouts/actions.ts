"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { createRefund } from "@/lib/stripe";
import { formatCents } from "@/lib/commerce-fee";
import {
  sendSaleRevertedBuyer,
  sendSaleRevertedArtist,
} from "@/lib/email";

/**
 * Cancel a paid primary sale: issue a Stripe refund, roll back artwork
 * ownership to the artist, remove the buyer's collection_membership, and
 * append a 'reverted' entry to the provenance ledger.
 *
 * Guards:
 * - Transaction must be status='paid'
 * - Artist payout must not already be 'paid' (money can't be recalled)
 */
export async function revertSale(
  transactionId: string,
  reason: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };
  if (!(await isAdmin())) return { error: "Admins only." };
  if (!reason.trim()) return { error: "A reason is required for the audit trail." };

  const admin = createAdminClient();

  const { data: tx } = await admin
    .from("primary_sale_transactions")
    .select("id, artwork_id, artist_id, buyer_id, buyer_email, buyer_name, sale_price_cents, buyer_paid_total_cents, currency, status, artist_payout_status, stripe_payment_intent")
    .eq("id", transactionId)
    .maybeSingle();

  if (!tx) return { error: "Transaction not found." };
  if (tx.status !== "paid") return { error: "Only paid transactions can be reverted." };
  if (tx.artist_payout_status === "paid") {
    return { error: "Payout already sent to artist — refund must be handled out-of-band." };
  }
  if (!tx.stripe_payment_intent) {
    return { error: "No Stripe payment intent on record — cannot issue automated refund." };
  }

  // Fetch artwork + artist profile in parallel
  const [{ data: artwork }, { data: artistProfile }] = await Promise.all([
    admin.from("artworks").select("id, ledger_id, creator_id, title, caption, image_url").eq("id", tx.artwork_id).maybeSingle(),
    admin.from("profiles").select("id, username, full_name").eq("id", tx.artist_id).maybeSingle(),
  ]);

  if (!artwork) return { error: "Artwork not found." };

  // Issue Stripe refund — abort before any DB writes if it fails
  try {
    await createRefund(tx.stripe_payment_intent);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `Stripe refund failed: ${msg}` };
  }

  const now = new Date().toISOString();
  const workTitle = artwork.title ?? artwork.caption ?? "Untitled";

  // DB writes — run rollback steps in sequence (each depends on success state)
  // 1. Roll back artwork to artist
  await admin
    .from("artworks")
    .update({ current_owner_id: tx.artist_id, is_available: true })
    .eq("id", tx.artwork_id);

  // 2. Remove buyer's collection_membership (shadow account is preserved)
  if (tx.buyer_id) {
    await admin
      .from("collection_membership")
      .delete()
      .eq("holder_id", tx.buyer_id)
      .eq("artwork_id", tx.artwork_id);
  }

  // 3. Append provenance ledger entry
  if (artwork.ledger_id) {
    await admin.from("artwork_provenance_ledger").insert({
      artwork_id: tx.artwork_id,
      ledger_id: artwork.ledger_id,
      entry_type: "reverted",
      from_owner_id: tx.buyer_id ?? tx.artist_id,
      to_owner_id: tx.artist_id,
      transfer_method: "direct",
      transferred_at: now,
      notes: reason.trim(),
      metadata: {
        reverted_by_admin_id: user.id,
        reverted_reason: reason.trim(),
        stripe_payment_intent: tx.stripe_payment_intent,
      },
    });
  }

  // 4. Mark transaction as reverted
  await admin
    .from("primary_sale_transactions")
    .update({
      status: "reverted",
      artist_payout_status: "cancelled",
      reverted_at: now,
      reverted_reason: reason.trim(),
      reverted_by: user.id,
    })
    .eq("id", transactionId);

  // 5. Fire-and-forget emails to buyer + artist
  const artistName = artistProfile?.full_name ?? artistProfile?.username ?? "the artist";
  const amountFormatted = formatCents(tx.buyer_paid_total_cents, tx.currency);

  sendSaleRevertedBuyer({
    toEmail: tx.buyer_email,
    buyerName: tx.buyer_name,
    workTitle,
    artistName,
    amountFormatted,
  }).catch(console.error);

  // Get artist email via admin client (bypasses RLS on auth.users)
  admin.auth.admin.getUserById(tx.artist_id).then(({ data }) => {
    const artistEmail = data?.user?.email;
    if (artistEmail) {
      sendSaleRevertedArtist({ toEmail: artistEmail, artistName, workTitle }).catch(console.error);
    }
  }).catch(console.error);

  revalidatePath("/admin/payouts");
  return {};
}

/**
 * Mark a seller / artist payout as paid. We track the manual disbursement
 * here; the actual money movement happens out-of-band (bank transfer or
 * Stripe Payouts dashboard) at single-digit volume.
 *
 * `kind` lets the same admin queue handle resale seller payouts and primary
 * sale artist payouts — both write to a status column on a *_transactions
 * table.
 */
export async function markSellerPayoutPaid(
  kind: "resale" | "primary_sale",
  transactionId: string,
  _note: string,  // captured server-side for audit trail in v2; UI shows it
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };
  if (!(await isAdmin())) return { error: "Admins only." };
  if (!_note.trim()) return { error: "Add a note (transfer reference, date, method)." };

  const admin = createAdminClient();
  const table = kind === "resale" ? "resale_transactions" : "primary_sale_transactions";
  const column = kind === "resale" ? "seller_payout_status" : "artist_payout_status";
  const { error } = await admin
    .from(table)
    .update({ [column]: "paid" })
    .eq("id", transactionId);
  if (error) return { error: error.message };

  revalidatePath("/admin/payouts");
  return {};
}

export async function markRoyaltyPaid(
  holdId: string,
  note: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };
  if (!(await isAdmin())) return { error: "Admins only." };
  if (!note.trim()) return { error: "Add a note (transfer reference, date, method)." };

  const admin = createAdminClient();
  const { data: hold, error: getError } = await admin
    .from("royalty_holds")
    .select("id, resale_transaction_id, status")
    .eq("id", holdId)
    .maybeSingle();
  if (getError) return { error: getError.message };
  if (!hold) return { error: "Hold not found." };
  if (hold.status !== "held") return { error: "This hold is already resolved." };

  await admin
    .from("royalty_holds")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      paid_via_note: note.trim(),
    })
    .eq("id", holdId);

  await admin
    .from("resale_transactions")
    .update({ royalty_status: "paid_to_artist" })
    .eq("id", hold.resale_transaction_id);

  revalidatePath("/admin/payouts");
  return {};
}

/**
 * 90-day expiry has hit and the artist still hasn't been paid → refund the
 * 5% to the seller. Keeps Patronage out of escrow regulation.
 */
export async function refundExpiredHold(
  holdId: string,
  note: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };
  if (!(await isAdmin())) return { error: "Admins only." };
  if (!note.trim()) return { error: "Add a note (refund reference, method)." };

  const admin = createAdminClient();
  const { data: hold } = await admin
    .from("royalty_holds")
    .select("id, resale_transaction_id, status")
    .eq("id", holdId)
    .maybeSingle();
  if (!hold) return { error: "Hold not found." };
  if (hold.status !== "held") return { error: "This hold is already resolved." };

  await admin
    .from("royalty_holds")
    .update({
      status: "refunded_to_seller",
      refunded_at: new Date().toISOString(),
      paid_via_note: note.trim(),
    })
    .eq("id", holdId);

  await admin
    .from("resale_transactions")
    .update({ royalty_status: "refunded_to_seller" })
    .eq("id", hold.resale_transaction_id);

  revalidatePath("/admin/payouts");
  return {};
}
