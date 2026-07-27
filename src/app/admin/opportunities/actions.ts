"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { revalidatePath } from "next/cache";
import { toSlug } from "@/lib/opportunity-slug";
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

export async function toggleOpportunityFeatured(id: string, current: boolean) {
  await guard();
  const supabase = await createClient();
  await supabase
    .from("opportunities")
    .update({ is_featured: !current })
    .eq("id", id);
  revalidatePath("/admin/opportunities");
  revalidatePath("/opportunities");
  revalidatePath("/");
}

/**
 * Recompute an opportunity's slug from its current title/organiser/deadline.
 * For fixing slugs that were generated back when title/organiser were still
 * blank (e.g. "-2027") — those never self-heal since there's no slug field in
 * the edit form and re-approval doesn't happen once a listing is already live.
 */
export async function regenerateOpportunitySlug(id: string): Promise<{ error?: string; slug?: string }> {
  await guard();
  const supabase = await createClient();

  const { data: opp } = await supabase
    .from("opportunities")
    .select("title, organiser, deadline")
    .eq("id", id)
    .single();
  if (!opp) return { error: "Opportunity not found" };

  const base = toSlug(opp.title ?? "", opp.organiser ?? null, opp.deadline ?? null);
  if (!base) return { error: "Title is blank — add one before regenerating the slug" };

  // Unique index on slug — retry with -2, -3... on collision (e.g. a duplicate listing).
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const { error } = await supabase
      .from("opportunities")
      .update({ slug: candidate })
      .eq("id", id);
    if (!error) {
      revalidatePath("/admin/opportunities");
      revalidatePath("/opportunities");
      revalidatePath(`/opportunities/${id}`);
      return { slug: candidate };
    }
    if (!error.message.toLowerCase().includes("duplicate")) {
      return { error: error.message };
    }
  }
  return { error: "Couldn't find a free slug — try renaming the listing slightly" };
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
