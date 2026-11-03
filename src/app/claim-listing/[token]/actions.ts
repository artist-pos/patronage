"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function claimListing(
  token: string,
  userId: string
): Promise<{ id: string } | { error: string }> {
  const admin = createAdminClient();

  const { data: opp, error: fetchError } = await admin
    .from("opportunities")
    .select("id, profile_id, claim_token_expires_at, organiser_profile_id")
    .eq("claim_token", token)
    .single();

  if (fetchError || !opp) return { error: "Listing not found" };
  if (opp.profile_id) return { error: "Already claimed" };

  // A listing linked to an organisation that's already on Patronage belongs
  // to that organisation's account, not to whoever opens the link.
  if (opp.organiser_profile_id && opp.organiser_profile_id !== userId) {
    const { data: org } = await admin
      .from("profiles")
      .select("full_name, account_status")
      .eq("id", opp.organiser_profile_id)
      .maybeSingle();
    if (org && org.account_status !== "shadow") {
      return {
        error: `This listing is managed by ${org.full_name ?? "its organisation"}'s account on Patronage. Sign in with that account, or contact hello@patronage.nz.`,
      };
    }
  }

  if (opp.claim_token_expires_at && new Date(opp.claim_token_expires_at) < new Date()) {
    return { error: "This claim link has expired. Please contact hello@patronage.nz for a new one." };
  }

  const { error: updateError } = await admin
    .from("opportunities")
    .update({ profile_id: userId })
    .eq("id", opp.id);

  if (updateError) return { error: updateError.message };

  revalidatePath("/dashboard");
  revalidatePath("/opportunities");

  return { id: opp.id };
}
