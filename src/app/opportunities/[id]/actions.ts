"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendApplicationConfirmation } from "@/lib/email";
import { getOpportunitySource } from "@/lib/opportunity-sources";
import type { ApplicationLink, OpportunityApplicationDraft, PipelineConfig } from "@/types/database";

export async function updateOpportunityAdmin(
  id: string,
  data: {
    title?: string;
    organiser?: string;
    caption?: string | null;
    full_description?: string | null;
    url?: string | null;
    application_links?: ApplicationLink[] | null;
    type?: string;
    country?: string;
    city?: string | null;
    featured_image_url?: string | null;
    secondary_image_url?: string | null;
    sub_categories?: string[] | null;
    career_stage?: string[] | null;
    tags?: string[] | null;
    opens_at?: string | null;
    deadline?: string | null;
    funding_range?: string | null;
    entry_fee?: number | null;         // amount in entry_fee_currency; server converts to NZD
    entry_fee_currency?: string | null;
    entry_fee_local?: number | null;
    grant_type?: string | null;
    recipients_count?: number | null;
    artist_payment_type?: string | null;
    travel_support?: boolean | null;
    travel_support_details?: string | null;
    routing_type?: string | null;
    source?: string | null;
    source_url?: string | null;
    show_badges_in_submission?: boolean;
    is_featured?: boolean;
    pipeline_config?: object | null;
    is_recurring?: boolean;
    recurrence_pattern?: string | null;
    recurrence_open_day?: number | null;
    recurrence_close_day?: number | null;
    recurrence_end_date?: string | null;
  }
) {
  if (!(await isAdmin())) throw new Error("Not authorised");
  const admin = createAdminClient();

  const updateData = { ...data };

  // Drop blank link rows the editor keeps around for in-progress typing.
  if (Array.isArray(updateData.application_links)) {
    updateData.application_links = updateData.application_links.filter(
      (l) => l && (l.url?.trim() || l.label?.trim())
    );
  }

  // Only keys the registry knows about can be stored — an unrecognised one
  // would render no attribution anyway, so treat it as "not sourced".
  if ("source" in updateData) {
    updateData.source = getOpportunitySource(updateData.source) ? updateData.source : null;
  }

  const currency = (data.entry_fee_currency ?? "NZD").toUpperCase();
  if (data.entry_fee != null && currency !== "NZD") {
    try {
      const rateRes = await fetch(`https://api.frankfurter.app/latest?from=${currency}&to=NZD`);
      const rateData = await rateRes.json() as { rates?: { NZD?: number } };
      const rate = rateData.rates?.NZD ?? 1;
      updateData.entry_fee_local = data.entry_fee;
      updateData.entry_fee = Math.round(data.entry_fee * rate * 100) / 100;
      updateData.entry_fee_currency = currency;
    } catch {
      // keep as-is on failure
    }
  } else if (currency === "NZD") {
    updateData.entry_fee_local = null;
    updateData.entry_fee_currency = null;
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
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Eligibility check + opportunity data fetched together — reused for email below
  const [{ data: pd }, { data: opp }] = await Promise.all([
    supabase.from("profiles").select("role, full_name, username").eq("id", user.id).single(),
    supabase.from("opportunities").select("type, routing_type, title, organiser, profile_id, pipeline_config").eq("id", opportunityId).single(),
  ]);

  const isArtist = pd?.role === "artist" || pd?.role === "owner";
  const isJobOpp = opp?.type === "Job / Employment";
  if (!isArtist && !(pd?.role === "patron" && isJobOpp)) {
    return { error: "You're not eligible to apply for this opportunity" };
  }

  const workIds = creativeWorkIds ?? [];
  const descriptions = pruneWorkDescriptions(workDescriptions, workIds, artworkId || null);

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
  const { error } = await supabase
    .from("opportunity_applications")
    .insert({
      opportunity_id: opportunityId,
      artist_id: user.id,
      artwork_id: artworkId || null,
      submitted_image_url: submittedImageUrl || null,
      custom_answers: answers,
      partner_marketing_opt_in: partnerMarketingOptIn ?? false,
      // creative_work_id mirrors the first pick for older single-work consumers.
      creative_work_id: workIds[0] ?? null,
      creative_work_ids: workIds.length > 0 ? workIds : null,
      work_descriptions: descriptions,
    });

  if (error) return { error: error.message };

  // Delete any saved draft on successful submission
  await supabase
    .from("opportunity_application_drafts")
    .delete()
    .eq("opportunity_id", opportunityId)
    .eq("artist_id", user.id);

  // Send confirmation email fire-and-forget — reuse opp fetched above
  const admin = createAdminClient();
  const authResult = await admin.auth.admin.getUserById(user.id);
  const authUser = authResult.data?.user ?? null;
  if (authUser?.email && opp) {
    const artistName = pd?.full_name ?? pd?.username ?? "Artist";
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
    sendApplicationConfirmation(
      authUser.email,
      artistName,
      opp.title,
      opp.organiser,
      `${siteUrl}/dashboard?tab=applications`
    ).catch(console.error);
  }

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
