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

export interface ClaimOwnerInfo {
  id: string;
  title: string;
  ownerLabel: string | null;
  opened: boolean;
}

/**
 * Who currently owns each listing — shown in the reset confirmation so an
 * accidental "Owned"/"Claimed" state can be told apart from a real partner
 * that would be cut loose by resetting.
 */
export async function getClaimOwners(ids: string[]): Promise<ClaimOwnerInfo[]> {
  await guard();
  if (ids.length === 0) return [];
  const supabase = await createClient();

  const { data } = await supabase
    .from("opportunities")
    .select("id, title, profile_id, claim_link_opened_at, profiles!opportunities_profile_id_fkey(username, full_name)")
    .in("id", ids);

  return (data ?? []).map((o) => {
    const profile = o.profiles as unknown as { username: string | null; full_name: string | null } | null;
    return {
      id: o.id as string,
      title: (o.title as string) ?? "",
      ownerLabel: o.profile_id
        ? profile?.full_name || profile?.username || "Unknown account"
        : null,
      opened: !!o.claim_link_opened_at,
    };
  });
}

/**
 * Put a listing back to unclaimed: drop the owner, wipe the open tracking and
 * issue a fresh claim token (the old link stops working). Invite history is
 * kept so the funnel still shows the listing was contacted.
 */
export async function resetClaimState(id: string): Promise<{ error?: string; claim_token?: string }> {
  await guard();
  const supabase = await createClient();

  const token = crypto.randomUUID();
  const { error } = await supabase
    .from("opportunities")
    .update({
      profile_id: null,
      claim_token: token,
      claim_token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      claim_link_opened_at: null,
      claim_link_open_count: 0,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/opportunities");
  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${id}`);
  return { claim_token: token };
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
