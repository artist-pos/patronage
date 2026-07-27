"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { notifyOpportunitySubmission } from "@/lib/email";
import { updateOpportunityPartner } from "@/app/partner/opportunities/[id]/edit/actions";
import { pickFreeListingFields } from "@/lib/free-listing";
import { pickPipelineListingFields } from "@/lib/pipeline-listing";
import { PIPELINE_TEMPLATES, type TemplateKey } from "@/lib/pipeline-templates";

export async function createOpportunityDraft(type: "free" | "pipeline"): Promise<{ id: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, username")
    .eq("id", user.id)
    .single();

  const organiser = profile?.full_name ?? profile?.username ?? "";

  const { data, error } = await supabase
    .from("opportunities")
    .insert({
      title: "",
      organiser,
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

/**
 * Turn an anonymous free-listing draft (collected client-side in localStorage)
 * into a real draft owned by the now-authenticated user. Returns the new id so
 * the client can drop them into the normal wizard to review and publish.
 */
export async function finalizeFreeListing(
  raw: Record<string, unknown>,
): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  let id: string;
  try {
    ({ id } = await createOpportunityDraft("free"));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create listing" };
  }

  const fields = pickFreeListingFields(raw);
  if (Object.keys(fields).length > 0) {
    try {
      await updateOpportunityPartner(id, fields as Parameters<typeof updateOpportunityPartner>[1]);
    } catch {
      // Still return the id — the draft exists and they can finish it in the wizard.
      return { id };
    }
  }

  return { id };
}

/**
 * Turn an anonymous pipeline-listing draft (Template + Basics, collected
 * client-side in localStorage) into a real draft owned by the now-authenticated
 * user. Returns the new id so the client can drop them into the normal wizard
 * at the Form Builder step to finish setup and publish.
 */
export async function finalizePipelineListing(
  raw: Record<string, unknown>,
  template: TemplateKey | null,
): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  let id: string;
  try {
    ({ id } = await createOpportunityDraft("pipeline"));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create listing" };
  }

  const fields = pickPipelineListingFields(raw);
  if (template) {
    fields.pipeline_config = { questions: PIPELINE_TEMPLATES[template], artist_documents: [], terms_pdf_url: null, template };
  }
  if (Object.keys(fields).length > 0) {
    try {
      await updateOpportunityPartner(id, fields as Parameters<typeof updateOpportunityPartner>[1]);
    } catch {
      // Still return the id — the draft exists and they can finish it in the wizard.
      return { id };
    }
  }

  return { id };
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
