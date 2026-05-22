"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { notifyOpportunitySubmission } from "@/lib/email";

export async function createOpportunityDraft(type: "free" | "pipeline"): Promise<{ id: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data, error } = await supabase
    .from("opportunities")
    .insert({
      title: "",
      organiser: "",
      description: null,
      type: "Grant",
      country: "NZ",
      status: "draft",
      routing_type: type === "pipeline" ? "pipeline" : "external",
      profile_id: user.id,
      is_active: false,
      is_featured: false,
      show_badges_in_submission: false,
      is_recurring: false,
      view_count: 0,
      claim_link_open_count: 0,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Could not create draft");
  return { id: data.id };
}

export async function submitDraftForReview(id: string): Promise<{ error?: string; redirectTo?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: opp } = await supabase
    .from("opportunities")
    .select("id, profile_id, status, routing_type, title, organiser, pipeline_paid_at")
    .eq("id", id)
    .maybeSingle();

  if (!opp) return { error: "Listing not found" };
  if (opp.profile_id !== user.id) return { error: "Not authorised" };
  if (!opp.title?.trim()) return { error: "Please add a title before submitting" };
  if (!opp.organiser?.trim()) return { error: "Please add an organiser name before submitting" };

  const { error: updateError } = await supabase
    .from("opportunities")
    .update({ status: "pending" })
    .eq("id", id)
    .eq("profile_id", user.id);

  if (updateError) return { error: updateError.message };

  revalidatePath("/partner/dashboard");

  // Notify admins
  notifyOpportunitySubmission({
    title: opp.title ?? "",
    organiser: opp.organiser ?? "",
    type: opp.routing_type ?? "external",
    submitterEmail: user.email ?? null,
    isFeatured: false,
    isPipeline: opp.routing_type === "pipeline",
    adminUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz"}/admin/opportunities/${id}`,
  }).catch(console.error);

  // Pipeline without a prior payment → send to payment gate
  if (opp.routing_type === "pipeline" && !opp.pipeline_paid_at) {
    return { redirectTo: `/partner/opportunities/${id}/activate` };
  }

  return { redirectTo: "/partner/dashboard" };
}
