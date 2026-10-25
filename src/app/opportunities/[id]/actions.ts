"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { sendApplicationConfirmation } from "@/lib/email";
import { assignNewApplication } from "@/lib/review-assignment";
import { TERMS_ACCEPTED_KEY } from "@/lib/application-terms";
import { normaliseOpportunityWrite } from "@/lib/opportunity-fields";
import type { OpportunityPayload } from "@/lib/opportunity-payload";
import { validPartnerProfileId } from "@/lib/organiser-link";
import type { ApplicationLink, OpportunityApplicationDraft, PipelineConfig } from "@/types/database";

export async function updateOpportunityAdmin(
  id: string,
  data: Partial<OpportunityPayload> & { entry_fee_local?: number | null }
) {
  if (!(await isAdmin())) throw new Error("Not authorised");
  const admin = createAdminClient();

  const updateData: Record<string, unknown> = await normaliseOpportunityWrite({ ...data });

  if ("organiser_profile_id" in updateData) {
    updateData.organiser_profile_id = await validPartnerProfileId(updateData.organiser_profile_id as string | null | undefined);
  }

  const { error } = await admin.from("opportunities").update(updateData).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/opportunities/${id}`);
  revalidatePath("/opportunities");
}

/**
 * Drop description overrides for works that are no longer attached, so a
 * deselected work can't leave orphaned text behind for the reviewer to see.
 * `artworkId` is the available-work pick, which lives outside creativeWorkIds.
 */
function pruneWorkDescriptions(
  workDescriptions: Record<string, string> | null | undefined,
  workIds: string[],
  artworkId: string | null,
): Record<string, string> {
  if (!workDescriptions) return {};
  const attached = new Set<string>(workIds);
  if (artworkId) attached.add(artworkId);
  const pruned: Record<string, string> = {};
  for (const [id, text] of Object.entries(workDescriptions)) {
    if (attached.has(id) && text.trim()) pruned[id] = text;
  }
  return pruned;
}

export async function saveDraft(
  opportunityId: string,
  artworkId: string | null,
  answers: Record<string, string>,
  submittedImageUrl?: string | null,
  creativeWorkIds?: string[] | null,
  workDescriptions?: Record<string, string> | null,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const workIds = creativeWorkIds ?? [];
  const { error } = await supabase
    .from("opportunity_application_drafts")
    .upsert({
      opportunity_id: opportunityId,
      artist_id: user.id,
      artwork_id: artworkId || null,
      submitted_image_url: submittedImageUrl || null,
      custom_answers: answers,
      updated_at: new Date().toISOString(),
      // creative_work_id mirrors the first pick for older single-work consumers.
      creative_work_id: workIds[0] ?? null,
      creative_work_ids: workIds.length > 0 ? workIds : null,
      work_descriptions: pruneWorkDescriptions(workDescriptions, workIds, artworkId || null),
    }, { onConflict: "opportunity_id,artist_id" });

  if (error) return { error: error.message };
  return {};
}

export async function getDraft(opportunityId: string): Promise<OpportunityApplicationDraft | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("opportunity_application_drafts")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .eq("artist_id", user.id)
    .single();

  return data ?? null;
}

export async function submitApplication(
  opportunityId: string,
  artworkId: string | null,
  answers: Record<string, string>,
  submittedImageUrl?: string | null,
  partnerMarketingOptIn?: boolean,
  creativeWorkIds?: string[] | null,
  workDescriptions?: Record<string, string> | null,
  termsAccepted?: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Eligibility check + opportunity data fetched together — reused for email below
  const [{ data: pd }, { data: opp }] = await Promise.all([
    supabase.from("profiles").select("role, full_name, username").eq("id", user.id).single(),
    supabase.from("opportunities").select("*").eq("id", opportunityId).single(),
  ]);

  // The page hides closed listings, but this action is callable directly.
  const today = new Date().toISOString().split("T")[0];
  if (!opp || opp.routing_type !== "pipeline" || opp.status !== "published" || !opp.is_active || opp.archived_at) {
    return { error: "This opportunity isn't accepting applications." };
  }
  if (opp.deadline && opp.deadline < today) {
    return { error: "Applications for this opportunity have closed." };
  }

  const isArtist = pd?.role === "artist" || pd?.role === "owner";
  const isJobOpp = opp?.type === "Job / Employment";
  if (!isArtist && !(pd?.role === "patron" && isJobOpp)) {
    return { error: "You're not eligible to apply for this opportunity" };
  }

  const workIds = creativeWorkIds ?? [];
  const descriptions = pruneWorkDescriptions(workDescriptions, workIds, artworkId || null);

  // Required questions are enforced here as well as in the form.
  const pipelineConfig = opp.pipeline_config as PipelineConfig | null;
  const requiredQuestions = pipelineConfig?.questions?.length
    ? pipelineConfig.questions.filter((q) => q.required)
    : [];
  const unanswered = requiredQuestions.filter((q) => {
    const value = answers[q.id];
    if (!value || !value.trim()) return true;
    if (q.type === "file_upload") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) && parsed.length === 0;
      } catch {
        return false;
      }
    }
    return false;
  });
  if (unanswered.length > 0) {
    return {
      error: unanswered.length === 1
        ? `Please answer: ${unanswered[0].label}`
        : `Please answer the required questions (${unanswered.length} left).`,
    };
  }

  // Terms: record the acceptance rather than implying it.
  const storedAnswers: Record<string, string> = { ...answers };
  delete storedAnswers[TERMS_ACCEPTED_KEY];
  if (pipelineConfig?.terms_pdf_url) {
    if (!termsAccepted) return { error: "Please accept the terms to submit." };
    storedAnswers[TERMS_ACCEPTED_KEY] = new Date().toISOString();
  }

  // When the partner requires per-work descriptions, every attached work must
  // have one — either written for this application or already on the work.
  // Re-checked here because ApplyModal's gate is client-side only.
  const wantsDescriptions =
    ((opp?.pipeline_config as PipelineConfig | null)?.work_descriptions_enabled ?? false);
  const attachedIds = [...workIds, ...(artworkId ? [artworkId] : [])];
  const undescribed = attachedIds.filter((id) => !descriptions[id]);
  if (wantsDescriptions && undescribed.length > 0) {
    // Only the works without an override need checking against their own row.
    const { data: workRows } = await supabase
      .from("artworks")
      .select("id, description")
      .in("id", undescribed);
    const described = new Set(
      (workRows ?? []).filter((w) => w.description?.trim()).map((w) => w.id)
    );
    if (undescribed.some((id) => !described.has(id))) {
      return { error: "Every work you attach needs a description." };
    }
  }
  const { data: inserted, error } = await supabase
    .from("opportunity_applications")
    .insert({
      opportunity_id: opportunityId,
      artist_id: user.id,
      artwork_id: artworkId || null,
      submitted_image_url: submittedImageUrl || null,
      custom_answers: storedAnswers,
      partner_marketing_opt_in: partnerMarketingOptIn ?? false,
      // creative_work_id mirrors the first pick for older single-work consumers.
      creative_work_id: workIds[0] ?? null,
      creative_work_ids: workIds.length > 0 ? workIds : null,
      work_descriptions: descriptions,
    })
    .select("id")
    .single();

  if (error) {
    // 23505 = the unique (opportunity, artist) constraint: they've already applied.
    if (error.code === "23505") return { error: "You've already applied for this opportunity." };
    return { error: error.message };
  }

  // Delete any saved draft on successful submission
  await supabase
    .from("opportunity_application_drafts")
    .delete()
    .eq("opportunity_id", opportunityId)
    .eq("artist_id", user.id);

  // Confirmation to the artist, and a heads-up to the organiser.
  const admin = createAdminClient();
  const artistName = pd?.full_name ?? pd?.username ?? "An artist";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
  after(async () => {
    try {
      if (inserted?.id) await assignNewApplication(admin, opportunityId, inserted.id as string);
    } catch (err) {
      console.error("[apply] reviewer assignment failed:", err);
    }
    try {
      // The organiser hears about new applications in the daily summary, not one by one.
      const artistAuth = await admin.auth.admin.getUserById(user.id);
      const artistEmail = artistAuth.data?.user?.email;
      if (artistEmail) {
        await sendApplicationConfirmation(artistEmail, artistName, opp.title, opp.organiser, `${siteUrl}/studio/opportunities?of=applied`);
      }
    } catch (err) {
      console.error("[apply] notification failed:", err);
    }
  });

  revalidatePath(`/opportunities/${opportunityId}`);
  revalidatePath("/dashboard");
  return {};
}

export async function rejectOpportunityAdmin(id: string) {
  if (!(await isAdmin())) throw new Error("Not authorised");
  const admin = createAdminClient();
  await admin
    .from("opportunities")
    .update({ status: "rejected", is_active: false })
    .eq("id", id);
  revalidatePath("/opportunities");
  redirect("/opportunities");
}
