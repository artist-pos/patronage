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
    .select("id, status, profile_id")
    .eq("claim_token", token)
    .single();

  if (fetchError || !opp) return { error: "Listing not found" };
  if (opp.profile_id) return { error: "Already claimed" };

  const updateData: Record<string, unknown> = { profile_id: userId };
  if (opp.status === "draft_unclaimed") {
    updateData.status = "draft";
  }

  const { error: updateError } = await admin
    .from("opportunities")
    .update(updateData)
    .eq("id", opp.id);

  if (updateError) return { error: updateError.message };

  revalidatePath("/partner/dashboard");
  revalidatePath("/opportunities");

  return { id: opp.id };
}
