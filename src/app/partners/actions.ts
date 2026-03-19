"use server";

import { createClient } from "@/lib/supabase/server";
import { notifyOpportunitySubmission } from "@/lib/email";

export interface SubmissionState {
  success?: boolean;
  error?: string;
}

export async function submitOpportunityAction(
  _prev: SubmissionState,
  formData: FormData
): Promise<SubmissionState> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const title = (formData.get("title") as string)?.trim();
  const organiser = (formData.get("organiser") as string)?.trim();
  if (!title || !organiser) return { error: "Title and organiser are required." };
  if (title.length > 200) return { error: "Title must be 200 characters or fewer." };
  if (organiser.length > 100) return { error: "Organiser name must be 100 characters or fewer." };

  const opens_at = (formData.get("opens_at") as string) || null;
  const deadline = (formData.get("deadline") as string) || null;
  const recipientsRaw = formData.get("recipients_count") as string;
  const subCatsRaw = (formData.get("sub_categories") as string)?.trim();
  const subCategories = subCatsRaw
    ? subCatsRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : null;

  const captionRaw = (formData.get("caption") as string)?.trim();

  const entryFeeRaw = formData.get("entry_fee") as string;
  const travelSupportRaw = formData.get("travel_support") as string;
  const routingType = (formData.get("routing_type") as string) || "external";
  const customFieldsRaw = (formData.get("custom_fields") as string) || "[]";
  const showBadgesRaw = (formData.get("show_badges_in_submission") as string) ?? "true";
  const pipelineConfigRaw = (formData.get("pipeline_config") as string) || "null";
  const isFeaturedRaw = (formData.get("is_featured") as string) ?? "false";
  const isRecurringRaw = (formData.get("is_recurring") as string) ?? "false";
  const recurrencePattern = (formData.get("recurrence_pattern") as string)?.trim() || null;
  const recurrenceEndDate = (formData.get("recurrence_end_date") as string)?.trim() || null;

  let customFields = [];
  try { customFields = JSON.parse(customFieldsRaw); } catch { customFields = []; }

  let pipelineConfig = null;
  try { pipelineConfig = JSON.parse(pipelineConfigRaw); } catch { pipelineConfig = null; }

  const { error } = await supabase.from("opportunity_submissions").insert({
    title,
    organiser,
    caption: captionRaw ? captionRaw.slice(0, 160) : null,
    full_description: (formData.get("full_description") as string)?.trim() || null,
    type: (formData.get("type") as string) || "Grant",
    country: (formData.get("country") as string) || "NZ",
    city: (formData.get("city") as string)?.trim() || null,
    opens_at: opens_at || null,
    deadline: deadline || null,
    url: (formData.get("url") as string)?.trim() || null,
    funding_range: (formData.get("funding_range") as string)?.trim() || null,
    entry_fee: entryFeeRaw !== "" && entryFeeRaw != null ? parseFloat(entryFeeRaw) : null,
    sub_categories: subCategories,
    featured_image_url: (formData.get("featured_image_url") as string)?.trim() || null,
    grant_type: (formData.get("grant_type") as string)?.trim() || null,
    recipients_count: recipientsRaw ? parseInt(recipientsRaw) : null,
    submitter_email: (formData.get("submitter_email") as string)?.trim() || null,
    profile_id: user?.id ?? null,
    travel_support: travelSupportRaw === "true" ? true : null,
    travel_support_details: (formData.get("travel_support_details") as string)?.trim() || null,
    routing_type: routingType,
    custom_fields: customFields,
    show_badges_in_submission: showBadgesRaw === "true",
    pipeline_config: pipelineConfig,
    is_featured: isFeaturedRaw === "true",
    is_recurring: isRecurringRaw === "true",
    recurrence_pattern: recurrencePattern,
    recurrence_end_date: recurrenceEndDate,
  });

  if (error) return { error: error.message };

  notifyOpportunitySubmission({
    title,
    organiser,
    type: (formData.get("type") as string) || "Grant",
    submitterEmail: (formData.get("submitter_email") as string)?.trim() || null,
    isFeatured: isFeaturedRaw === "true",
    isPipeline: routingType === "pipeline",
    adminUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz"}/admin`,
  }).catch(console.error);

  return { success: true };
}
