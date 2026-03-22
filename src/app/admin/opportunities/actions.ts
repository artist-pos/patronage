"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { revalidatePath } from "next/cache";
import type { Opportunity } from "@/types/database";

async function guard() {
  if (!(await isAdmin())) throw new Error("Not authorised");
}

export async function toggleOpportunityActive(id: string, current: boolean) {
  await guard();
  const supabase = await createClient();
  await supabase
    .from("opportunities")
    .update({ is_active: !current })
    .eq("id", id);
  revalidatePath("/admin/opportunities");
  revalidatePath("/opportunities");
}

export async function deleteOpportunity(id: string) {
  await guard();
  const supabase = await createClient();
  await supabase.from("opportunities").delete().eq("id", id);
  revalidatePath("/admin/opportunities");
  revalidatePath("/opportunities");
}

export async function createDraftUnclaimedListing(): Promise<Opportunity> {
  await guard();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("opportunities")
    .insert({
      title: "Untitled listing",
      organiser: "",
      type: "Grant",
      country: "NZ",
      status: "draft_unclaimed",
      is_active: false,
      routing_type: "external",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/admin/opportunities");
  return data as Opportunity;
}

export async function generateClaimToken(
  id: string,
  email?: string
): Promise<{ claim_token: string }> {
  await guard();
  const supabase = await createClient();
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("opportunities")
    .update({
      claim_token: token,
      claim_email: email ?? null,
      claim_token_expires_at: expiresAt,
      // Reset ownership so the new token isn't blocked by a previous claim
      profile_id: null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/opportunities");
  return { claim_token: token };
}
