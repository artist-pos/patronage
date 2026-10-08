"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/supabase/get-server-user";

export type AccountChoice = "patron" | "artist" | "organisation";

/** Let a guest reviewer say what to call them. */
export async function setReviewerName(name: string): Promise<{ error?: string }> {
  const { supabase, user } = await getServerUser();
  if (!user) return { error: "Please sign in again." };
  const trimmed = name.trim().slice(0, 80);
  if (!trimmed) return { error: "Enter a name." };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "reviewer") return { error: "Not available for this account." };
  const { error } = await createAdminClient().from("profiles").update({ full_name: trimmed }).eq("id", user.id);
  return error ? { error: error.message } : {};
}

/**
 * Turn a guest reviewer into a full account. Their review access is attached to
 * their profile, so it carries over unchanged. Choosing "organisation" files them
 * under the organisation that invited them.
 */
export async function upgradeReviewerAccount(
  choice: AccountChoice,
  opportunityId: string,
): Promise<{ error?: string; redirectTo?: string }> {
  const { supabase, user } = await getServerUser();
  if (!user) return { error: "Please sign in again." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "reviewer") return { error: "This account is already set up." };

  const admin = createAdminClient();

  if (choice === "patron") {
    const { error } = await admin.from("profiles").update({ role: "patron" }).eq("id", user.id);
    return error ? { error: error.message } : { redirectTo: "/onboarding/patron" };
  }

  if (choice === "artist") {
    const { error } = await admin.from("profiles").update({ role: "artist" }).eq("id", user.id);
    return error ? { error: error.message } : { redirectTo: "/onboarding/profile" };
  }

  const { data: opp } = await admin.from("opportunities").select("profile_id").eq("id", opportunityId).maybeSingle();
  if (!opp?.profile_id) return { error: "We couldn't find the organisation." };
  const { error } = await admin
    .from("profiles")
    .update({ role: "partner", invited_by_org_id: opp.profile_id as string })
    .eq("id", user.id);
  return error ? { error: error.message } : { redirectTo: "/onboarding/partner" };
}
