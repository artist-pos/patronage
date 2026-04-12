"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendApplicationConfirmation } from "@/lib/email";
import type { OpportunityApplicationDraft } from "@/types/database";

export async function updateOpportunityAdmin(
  id: string,
  data: {
    title?: string;
    organiser?: string;
    caption?: string | null;
    full_description?: string | null;
    url?: string | null;
    type?: string;
    country?: string;
    city?: string | null;
    featured_image_url?: string | null;
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

export async function saveDraft(
  opportunityId: string,
  artworkId: string | null,
  answers: Record<string, string>,
  submittedImageUrl?: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("opportunity_application_drafts")
    .upsert({
      opportunity_id: opportunityId,
      artist_id: user.id,
      artwork_id: artworkId || null,
      submitted_image_url: submittedImageUrl || null,
      custom_answers: answers,
      updated_at: new Date().toISOString(),
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
  partnerMarketingOptIn?: boolean
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("opportunity_applications")
    .insert({
      opportunity_id: opportunityId,
      artist_id: user.id,
      artwork_id: artworkId || null,
      submitted_image_url: submittedImageUrl || null,
      custom_answers: answers,
      partner_marketing_opt_in: partnerMarketingOptIn ?? false,
    });

  if (error) return { error: error.message };

  // Delete any saved draft on successful submission
  await supabase
    .from("opportunity_application_drafts")
    .delete()
    .eq("opportunity_id", opportunityId)
    .eq("artist_id", user.id);

  // Send confirmation email fire-and-forget
  const admin = createAdminClient();
  const [authResult, { data: opp }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(user.id),
    admin.from("opportunities").select("title, organiser, profile_id").eq("id", opportunityId).single(),
    admin.from("profiles").select("full_name, username").eq("id", user.id).single(),
  ]);

  const authUser = authResult.data?.user ?? null;
  if (authUser?.email && opp) {
    const artistName = profile?.full_name ?? profile?.username ?? "Artist";
    const partnerName = opp.organiser;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
    sendApplicationConfirmation(
      authUser.email,
      artistName,
      opp.title,
      partnerName,
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
