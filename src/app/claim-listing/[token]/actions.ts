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
    .select("id, profile_id, claim_token_expires_at")
    .eq("claim_token", token)
    .single();

  if (fetchError || !opp) return { error: "Listing not found" };
  if (opp.profile_id) return { error: "Already claimed" };

  if (opp.claim_token_expires_at && new Date(opp.claim_token_expires_at) < new Date()) {
    return { error: "This claim link has expired. Please contact hello@patronage.nz for a new one." };
  }

  const { error: updateError } = await admin
    .from("opportunities")
    .update({ profile_id: userId })
    .eq("id", opp.id);

  if (updateError) return { error: updateError.message };

  revalidatePath("/partner/dashboard");
  revalidatePath("/opportunities");

  return { id: opp.id };
}
