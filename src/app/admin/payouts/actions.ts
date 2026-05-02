"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";

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
